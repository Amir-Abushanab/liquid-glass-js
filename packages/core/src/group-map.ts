// Merged-glass displacement map — N rounded rects fused by a smooth-min: the
// SVG answer to Apple's GlassEffectContainer, where elements closer than the
// container's spacing "physically merge, like water droplets".
//
// The single-shape generator (displacement.ts) is four-fold symmetric and
// centre-directed; a union has neither a symmetry nor a centre. So this one
// evaluates the merged SDF into a field buffer (one SDF eval per pixel, plus a
// 1px apron) and takes the displacement DIRECTION from the field's gradient —
// central differences over the buffer, not extra SDF evals. Gradient direction
// is also what makes the merge look right: in the neck between two shapes the
// normal rotates smoothly from one rim to the other, so the refraction flows
// with the fused silhouette instead of tearing between two centres.
//
// Wire format is map-encode's (R/G = offset, B = specular, 128 = neutral).
// The whole map is neutral-filled in one pass and only the shapes' union bbox
// (+ a blend/depth apron) is computed, so the cost tracks the glass, not the
// pane it sits over. No dome: a union has no centre to swell from — the group
// is bevel-only, which is also how Apple's merged controls read.

import { encodeOffset, encodeSpec } from './map-encode';
import { erf, type MapProfile } from './displacement';

export interface GroupShape {
  x: number; // left, px, in the map's (= the refract pane's) coordinates
  y: number;
  w: number;
  h: number;
  /** Corner radius, px (clamped to the half-size). */
  r: number;
}

export interface GroupMapOptions {
  width: number; // full map size = the refract pane's box, px
  height: number;
  shapes: GroupShape[];
  /**
   * Smooth-min k, px. Rims begin bulging toward each other inside this
   * distance; the quadratic smin's reach is k/4 per side, so silhouettes
   * BRIDGE at a gap of about k/2. 0 = hard union.
   */
  blend: number;
  depth: number;
  profile?: MapProfile;
  edge?: number; // rim glint strength
  glow?: number; // axial sheen strength
  shade?: number; // dark occlusion rim opposite the glint
  specularRotation?: number; // degrees, default 45
}

// RGBA(128,128,128,255) as one little-endian u32 write — the neutral fill.
const NEUTRAL_PX = 0xff808080;

function sdRoundedRect(px: number, py: number, s: GroupShape): number {
  const r = Math.min(s.r, Math.min(s.w, s.h) / 2);
  const dx = Math.abs(px - (s.x + s.w / 2)) - (s.w / 2 - r);
  const dy = Math.abs(py - (s.y + s.h / 2)) - (s.h / 2 - r);
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - r;
}

// iq's quadratic smooth-min. Well-defined against the Infinity seed: |a−b| is
// Infinity there, so h = 0 and the result is plain min.
function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export function renderGroupDisplacementMap(o: GroupMapOptions): HTMLCanvasElement {
  const profile = o.profile ?? 'erf';
  const depth = o.depth;
  const blend = Math.max(0, o.blend);
  const edge = o.edge ?? 0;
  const glow = o.glow ?? 0;
  const shade = o.shade ?? 0;

  const cw = Math.max(1, Math.round(o.width));
  const chh = Math.max(1, Math.round(o.height));
  const cv = document.createElement('canvas');
  cv.width = cw;
  cv.height = chh;
  const ctx = cv.getContext('2d');
  if (!ctx) return cv;
  const img = ctx.createImageData(cw, chh);
  new Uint32Array(img.data.buffer).fill(NEUTRAL_PX);

  // Active rect: the union bbox padded by everything that can reach past a
  // shape's own edge — the fuse distance and a little slack for the gradient
  // apron. (depth and the specular band reach INWARD, not outward.)
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of o.shapes) {
    x0 = Math.min(x0, s.x);
    y0 = Math.min(y0, s.y);
    x1 = Math.max(x1, s.x + s.w);
    y1 = Math.max(y1, s.y + s.h);
  }
  const pad = Math.ceil(blend + 4);
  x0 = Math.max(0, Math.floor(x0 - pad));
  y0 = Math.max(0, Math.floor(y0 - pad));
  x1 = Math.min(cw, Math.ceil(x1 + pad));
  y1 = Math.min(chh, Math.ceil(y1 + pad));
  const aw = x1 - x0;
  const ah = y1 - y0;
  if (o.shapes.length && aw > 0 && ah > 0) {
    // The merged field, with a 1px apron so every active pixel has neighbours.
    const fw = aw + 2;
    const fh = ah + 2;
    const f = new Float32Array(fw * fh);
    for (let j = 0; j < fh; j++) {
      const py = y0 + j - 1 + 0.5;
      for (let i2 = 0; i2 < fw; i2++) {
        const px = x0 + i2 - 1 + 0.5;
        let d = Infinity;
        for (const s of o.shapes) d = smin(d, sdRoundedRect(px, py, s), blend);
        f[j * fw + i2] = d;
      }
    }

    const E = depth > 0 ? 1 / (depth * Math.SQRT2) : 1e6;
    const rot = ((o.specularRotation ?? 45) * Math.PI) / 180;
    const ck = Math.cos(rot);
    const sk = Math.sin(rot);
    const specOn = edge > 0 || glow > 0 || shade > 0;
    const edgeW = 3;
    const edgeExp = 1.5;
    const glowExp = 1.5;
    const GT = Math.SQRT2; // glowSpread 1, as the single-shape generator ships

    for (let row = 0; row < ah; row++) {
      for (let col = 0; col < aw; col++) {
        const fi = (row + 1) * fw + (col + 1);
        const dist = f[fi];
        if (dist >= 0) continue; // outside the union: stays neutral
        // Magnitude: the same two falloff profiles as the single-shape map,
        // measured on the merged SDF (dist + depth = the inner parallel curve).
        let i: number;
        if (profile === 'circle') {
          const t = depth > 0 ? Math.max(0, 1 + dist / depth) : 0;
          i = 1 - Math.sqrt(1 - t * t);
        } else {
          i = 0.5 * (1 + erf((dist + depth) * E));
        }
        // Direction: the outward normal, from the field's own gradient. On the
        // interior plateau the gradient degenerates — and i ≈ 0 there, so a
        // zero direction is exact, not a fudge.
        const gx = (f[fi + 1] - f[fi - 1]) * 0.5;
        const gy = (f[fi + fw] - f[fi - fw]) * 0.5;
        const len = Math.hypot(gx, gy);
        const nx = len > 1e-4 ? gx / len : 0;
        const ny = len > 1e-4 ? gy / len : 0;
        const t4 = ((y0 + row) * cw + (x0 + col)) * 4;
        // Sample toward the interior (magnification), as everywhere else.
        img.data[t4] = encodeOffset(-nx * i);
        img.data[t4 + 1] = encodeOffset(-ny * i);
        if (specOn) {
          // The single-shape generator projects the pixel's POSITION onto the
          // light axis; with a live normal we can project the normal itself —
          // identical at the rim, and it follows the fused neck for free.
          const linSigned = nx * ck + ny * sk;
          const lin = Math.abs(linSigned);
          const band = Math.max(0, 1 + dist / edgeW);
          const shadow = Math.max(0, -linSigned);
          let r = 0;
          if (glow > 0) r += glow * Math.pow(Math.min(1, Math.max(0, lin) / GT), glowExp) * i;
          if (edge > 0) {
            r += edge * band * Math.pow(Math.max(0, linSigned), edgeExp);
            r += edge * band * (1 - shade) * Math.pow(shadow, edgeExp);
          }
          if (shade > 0) r -= shade * band * Math.pow(shadow, edgeExp);
          img.data[t4 + 2] = encodeSpec(r);
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

export function buildGroupDisplacementMap(o: GroupMapOptions): string {
  return renderGroupDisplacementMap(o).toDataURL();
}
