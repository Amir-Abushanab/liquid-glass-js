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
  /**
   * Radius, px, of a box blur applied to a COPY of the field that only the
   * displacement DIRECTION (and the specular normal) reads — magnitude and
   * coverage keep the exact field, so the rim stays crisp. Default 0 (off).
   *
   * Why: an exact SDF's gradient kinks on the shape's medial axis — for a
   * rounded rect, the 45° diagonals running inward from each corner — and a
   * direction taken from it folds the refraction along those lines: a visible
   * crease at every corner, worst under content with straight lines. Smoothing
   * the field the direction reads turns the kink into a gentle swirl; at the
   * silhouette itself the blurred gradient matches the true normal to within
   * ~r/R (blur radius over corner radius), so nothing else moves.
   */
  smoothNormals?: number;
}

// Separable box blur with edge-clamped windows, used on the direction field.
function boxBlurField(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const win = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const off = y * w;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[off + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[off + x] = acc / win;
      acc += src[off + Math.min(w - 1, x + r + 1)] - src[off + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / win;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
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

  // Active rects: each shape's bbox expanded by the fuse reach, with
  // overlapping expansions merged into clusters, and the field evaluated per
  // cluster. Far-apart shapes then cost two small patches instead of one rect
  // spanning the gap — the case a drifting lens far from its blob lives in.
  // Cluster-local smin is exact, not approximate: a pixel inside cluster A's
  // patch sits outside every other cluster's patch, so every foreign SDF
  // there exceeds `pad` — too far to win the min where it matters (the pixels
  // that render have sdf < ~blend/4) and too far to engage the smooth band.
  const pad = Math.ceil(blend + 4);
  interface Cluster {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    shapes: GroupShape[];
  }
  const clusters: Cluster[] = o.shapes.map((s) => ({
    x0: Math.max(0, Math.floor(s.x - pad)),
    y0: Math.max(0, Math.floor(s.y - pad)),
    x1: Math.min(cw, Math.ceil(s.x + s.w + pad)),
    y1: Math.min(chh, Math.ceil(s.y + s.h + pad)),
    shapes: [s],
  }));
  for (let merged = true; merged;) {
    merged = false;
    outer: for (let a = 0; a < clusters.length; a++) {
      for (let b = a + 1; b < clusters.length; b++) {
        const A = clusters[a];
        const B = clusters[b];
        if (A.x0 < B.x1 && B.x0 < A.x1 && A.y0 < B.y1 && B.y0 < A.y1) {
          A.x0 = Math.min(A.x0, B.x0);
          A.y0 = Math.min(A.y0, B.y0);
          A.x1 = Math.max(A.x1, B.x1);
          A.y1 = Math.max(A.y1, B.y1);
          A.shapes.push(...B.shapes);
          clusters.splice(b, 1);
          merged = true;
          break outer;
        }
      }
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

  for (const c of clusters) {
    const { x0, y0 } = c;
    const aw = c.x1 - c.x0;
    const ah = c.y1 - c.y0;
    if (aw <= 0 || ah <= 0) continue;
    // The cluster's field, with an apron so every active pixel has neighbours —
    // one extra ring per px of normal smoothing, so the blur never reads
    // outside the evaluated field.
    const sr = Math.max(0, Math.round(o.smoothNormals ?? 0));
    const ap = 1 + sr;
    const fw = aw + 2 * ap;
    const fh = ah + 2 * ap;
    const f = new Float32Array(fw * fh);
    for (let j = 0; j < fh; j++) {
      const py = y0 + j - ap + 0.5;
      for (let i2 = 0; i2 < fw; i2++) {
        const px = x0 + i2 - ap + 0.5;
        let d = Infinity;
        for (const s of c.shapes) d = smin(d, sdRoundedRect(px, py, s), blend);
        f[j * fw + i2] = d;
      }
    }
    // Direction (and the specular normal) reads the smoothed field; magnitude
    // and coverage keep the exact one. See the smoothNormals doc above.
    const g = sr > 0 ? boxBlurField(f, fw, fh, sr) : f;

    for (let row = 0; row < ah; row++) {
      for (let col = 0; col < aw; col++) {
        const fi = (row + ap) * fw + (col + ap);
        const dist = f[fi];
        if (dist >= 0.5) continue; // outside the rim + its feather: stays neutral
        // 1px coverage feather across the silhouette (the standard SDF
        // antialias, cov = clamp(0.5 − d)). The map is consumed at CSS px, so
        // a hard dist<0 step bakes a staircase into the rim, and a per-move
        // regenerate makes that staircase CRAWL — the edge flicker, worst in
        // WebKit's software filter path. Feathering magnitude and specular
        // over the boundary pixel is what a supersampled downscale would
        // produce at the rim, without the 4× field cost.
        const cov = Math.min(1, 0.5 - dist);
        // Magnitude: the same two falloff profiles as the single-shape map,
        // measured on the merged SDF (dist + depth = the inner parallel curve).
        let i: number;
        if (profile === 'circle') {
          const t = depth > 0 ? Math.max(0, Math.min(1, 1 + dist / depth)) : 0;
          i = 1 - Math.sqrt(1 - t * t);
        } else {
          i = 0.5 * (1 + erf((dist + depth) * E));
        }
        i *= cov;
        // Direction: the outward normal, from the (optionally smoothed) field's
        // gradient. On the interior plateau the gradient degenerates — and
        // i ≈ 0 there, so a zero direction is exact, not a fudge.
        const gx = (g[fi + 1] - g[fi - 1]) * 0.5;
        const gy = (g[fi + fw] - g[fi - fw]) * 0.5;
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
          const band = Math.min(1, Math.max(0, 1 + dist / edgeW));
          const shadow = Math.max(0, -linSigned);
          let r = 0;
          if (glow > 0) r += glow * Math.pow(Math.min(1, Math.max(0, lin) / GT), glowExp) * i;
          if (edge > 0) {
            r += edge * band * Math.pow(Math.max(0, linSigned), edgeExp);
            r += edge * band * (1 - shade) * Math.pow(shadow, edgeExp);
          }
          if (shade > 0) r -= shade * band * Math.pow(shadow, edgeExp);
          img.data[t4 + 2] = encodeSpec(r * cov);
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

export interface GroupSilhouetteOptions {
  width: number; // full canvas size = the refract pane's box, px
  height: number;
  shapes: GroupShape[];
  /** Same smooth-min k as the displacement map — the two must agree on the neck. */
  blend: number;
}

// The union's alpha silhouette — white inside the fused shapes, transparent
// outside, with the same 1px coverage feather the map uses at the rim. For CSS
// `mask-image` on the refract pane: a pane that spans several shapes (the
// droplet menu's trigger + panel) must not paint the page between them, and no
// CSS shape can express the smin neck — only the SDF that made it. Evaluated
// from the same sdRoundedRect/smin as renderGroupDisplacementMap, so mask and
// refraction can never disagree about where glass is.
//
// One union bbox rather than the map's clusters: a mask exists to be pane-sized
// and its per-pixel work is a fraction of the map's (no gradient, no specular),
// so the cluster machinery would save little and duplicate the subtle part.
export function renderGroupSilhouette(o: GroupSilhouetteOptions): HTMLCanvasElement {
  const blend = Math.max(0, o.blend);
  const cw = Math.max(1, Math.round(o.width));
  const chh = Math.max(1, Math.round(o.height));
  const cv = document.createElement('canvas');
  cv.width = cw;
  cv.height = chh;
  const ctx = cv.getContext('2d');
  if (!ctx || !o.shapes.length) return cv;
  const img = ctx.createImageData(cw, chh);

  // Coverage reaches to sdf < 0.5; smin can pull the surface outward by at most
  // k/4, so the bbox needs only that much apron (plus the feather pixel).
  const pad = Math.ceil(blend * 0.25 + 2);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of o.shapes) {
    x0 = Math.min(x0, s.x - pad);
    y0 = Math.min(y0, s.y - pad);
    x1 = Math.max(x1, s.x + s.w + pad);
    y1 = Math.max(y1, s.y + s.h + pad);
  }
  x0 = Math.max(0, Math.floor(x0));
  y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(cw, Math.ceil(x1));
  y1 = Math.min(chh, Math.ceil(y1));

  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      let d = Infinity;
      for (const s of o.shapes) d = smin(d, sdRoundedRect(px + 0.5, py + 0.5, s), blend);
      if (d >= 0.5) continue;
      const cov = Math.min(1, 0.5 - d);
      const t4 = (py * cw + px) * 4;
      img.data[t4] = 255;
      img.data[t4 + 1] = 255;
      img.data[t4 + 2] = 255;
      img.data[t4 + 3] = Math.round(cov * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

export function buildGroupSilhouette(o: GroupSilhouetteOptions): string {
  return renderGroupSilhouette(o).toDataURL();
}

export interface GroupOutlineOptions extends GroupSilhouetteOptions {
  /** Marching-squares cell, px (default 2). Chord error is ~cell²/(8·radius) — sub-pixel at UI radii. */
  cell?: number;
}

// The silhouette as an SVG path string (px, pane coordinates): the zero isoline
// of the same smin field, marched at `cell` resolution with linear-interpolated
// crossings, straight runs collapsed. For CSS `clip-path: path(...)` on the
// refract pane. The raster mask above and this trace draw the same curve; the
// difference is the frame loop: a clip-path string commits synchronously with
// the styles that move the shapes, while a mask-image data URL decodes on its
// own schedule — so a per-frame morph stays tear-free only with the trace.
export function traceGroupSilhouette(o: GroupOutlineOptions): string {
  const blend = Math.max(0, o.blend);
  const cell = Math.max(1, o.cell ?? 2);
  if (!o.shapes.length) return 'M 0 0';

  // Node grid over the union bbox, padded so every boundary node is outside the
  // surface (smin reaches k/4 past a shape) — loops then always close in-grid.
  const pad = blend * 0.25 + 2 * cell + 2;
  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -Infinity;
  let by1 = -Infinity;
  for (const s of o.shapes) {
    bx0 = Math.min(bx0, s.x - pad);
    by0 = Math.min(by0, s.y - pad);
    bx1 = Math.max(bx1, s.x + s.w + pad);
    by1 = Math.max(by1, s.y + s.h + pad);
  }
  const nx = Math.max(2, Math.ceil((bx1 - bx0) / cell) + 1);
  const ny = Math.max(2, Math.ceil((by1 - by0) / cell) + 1);
  const f = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const py = by0 + j * cell;
    for (let i = 0; i < nx; i++) {
      const px = bx0 + i * cell;
      let d = Infinity;
      for (const s of o.shapes) d = smin(d, sdRoundedRect(px, py, s), blend);
      f[j * nx + i] = d;
    }
  }

  // March the cells into undirected boundary segments (x1,y1,x2,y2 quads).
  const segs: number[] = [];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const f00 = f[j * nx + i];
      const f10 = f[j * nx + i + 1];
      const f01 = f[(j + 1) * nx + i];
      const f11 = f[(j + 1) * nx + i + 1];
      const idx = (f00 < 0 ? 1 : 0) | (f10 < 0 ? 2 : 0) | (f11 < 0 ? 4 : 0) | (f01 < 0 ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const x = bx0 + i * cell;
      const y = by0 + j * cell;
      // Crossing points on each cell edge (valid only where that edge's corner
      // signs differ — the case table below only reads valid ones).
      const tx = x + (f00 / (f00 - f10)) * cell; // top
      const rx = x + cell;
      const ry = y + (f10 / (f10 - f11)) * cell; // right
      const bx = x + (f01 / (f01 - f11)) * cell; // bottom
      const by = y + cell;
      const ly = y + (f00 / (f00 - f01)) * cell; // left
      const T = [tx, y];
      const R = [rx, ry];
      const B = [bx, by];
      const L = [x, ly];
      const put = (a: number[], b: number[]) => segs.push(a[0], a[1], b[0], b[1]);
      switch (idx) {
        case 1:
          put(L, T);
          break;
        case 2:
          put(T, R);
          break;
        case 3:
          put(L, R);
          break;
        case 4:
          put(R, B);
          break;
        case 6:
        case 9:
          put(T, B);
          break;
        case 7:
        case 8:
          put(L, B);
          break;
        case 11:
          put(R, B);
          break;
        case 12:
          put(L, R);
          break;
        case 13:
          put(T, R);
          break;
        case 14:
          put(L, T);
          break;
        case 5:
        case 10: {
          // Saddle: disambiguate with the true field at the cell centre.
          let c = Infinity;
          const cx = x + cell / 2;
          const cy = y + cell / 2;
          for (const s of o.shapes) c = smin(c, sdRoundedRect(cx, cy, s), blend);
          const joined = c < 0 === (idx === 5);
          // idx 5 (00,11 in): centre in → outside corners isolate: (T,R)+(B,L);
          // centre out → inside corners isolate: (L,T)+(R,B). idx 10 mirrors.
          if (joined) {
            put(T, R);
            put(B, L);
          } else {
            put(L, T);
            put(R, B);
          }
          break;
        }
      }
    }
  }
  if (!segs.length) return 'M 0 0';

  // Chain segments into closed loops by shared endpoints (quantized keys — the
  // crossing on a shared edge is computed from the same two node values in both
  // cells, so endpoints match exactly; quantization only absorbs float noise).
  const key = (px: number, py: number) => `${Math.round(px * 16)},${Math.round(py * 16)}`;
  const at = new Map<string, number[]>(); // endpoint key -> segment indices
  const nSegs = segs.length / 4;
  for (let s = 0; s < nSegs; s++) {
    for (const k of [key(segs[s * 4], segs[s * 4 + 1]), key(segs[s * 4 + 2], segs[s * 4 + 3])]) {
      const list = at.get(k);
      if (list) list.push(s);
      else at.set(k, [s]);
    }
  }
  const used = new Uint8Array(nSegs);
  const out: string[] = [];
  const EPS = 0.12; // straight-run collapse tolerance, px
  for (let s0 = 0; s0 < nSegs; s0++) {
    if (used[s0]) continue;
    used[s0] = 1;
    const pts: number[] = [segs[s0 * 4], segs[s0 * 4 + 1], segs[s0 * 4 + 2], segs[s0 * 4 + 3]];
    const startKey = key(pts[0], pts[1]);
    for (;;) {
      const cx = pts[pts.length - 2];
      const cy = pts[pts.length - 1];
      const ck = key(cx, cy);
      if (ck === startKey) break;
      const nextSeg = (at.get(ck) ?? []).find((s) => !used[s]);
      if (nextSeg == null) break; // open chain — shouldn't happen with the pad, bail safely
      used[nextSeg] = 1;
      const headIsStart = key(segs[nextSeg * 4], segs[nextSeg * 4 + 1]) === ck;
      pts.push(
        segs[nextSeg * 4 + (headIsStart ? 2 : 0)],
        segs[nextSeg * 4 + (headIsStart ? 3 : 1)],
      );
    }
    // Streaming collinear collapse: drop a point that sits within EPS of the
    // line from the last kept point to its successor.
    const n = pts.length / 2 - 1; // last point closes onto the first
    if (n < 3) continue;
    let d = `M${pts[0].toFixed(2)} ${pts[1].toFixed(2)}`;
    let kx = pts[0];
    let ky = pts[1];
    for (let i = 1; i < n; i++) {
      const px = pts[i * 2];
      const py = pts[i * 2 + 1];
      const qx = pts[((i + 1) % n) * 2];
      const qy = pts[((i + 1) % n) * 2 + 1];
      const ux = qx - kx;
      const uy = qy - ky;
      const len = Math.hypot(ux, uy) || 1;
      if (Math.abs((px - kx) * uy - (py - ky) * ux) / len < EPS) continue;
      d += `L${px.toFixed(2)} ${py.toFixed(2)}`;
      kx = px;
      ky = py;
    }
    out.push(d + 'Z');
  }
  return out.length ? out.join('') : 'M 0 0';
}
