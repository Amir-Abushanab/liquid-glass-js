// Liquid-glass displacement map — exact port of Aave's generator
// (bundle module 2753 + the o() canvas loop). Framework-agnostic.
//
// Produces a PNG data URL encoding a rounded-rect SDF normal map:
//   R = X-displacement, G = Y-displacement (centered on 128 = no shift)
//   B = directional edge/glow specular
// The lens is rendered at `width`×`height`, centered inside a canvas padded by
// `margin` on every side (neutral 128) so an over-sized refraction layer can
// bleed without sampling transparency at the rim.

import { encodeOffset, encodeSpec, NEUTRAL_BYTE } from './map-encode';

export interface GlassMapOptions {
  width: number;
  height: number;
  radius: number;
  depth: number;
  dome?: number; // px sagitta (bulge height)
  edge?: number; // edge-line specular strength
  glow?: number; // axial glow specular strength
  shade?: number; // dark occlusion rim opposite the glint (0–1, default 0)
  margin?: number; // bleed padding, px
  specularRotation?: number; // degrees, default 45
  pxScale?: number; // supersample factor: keeps px-hardcoded bands (edgeW) a constant
  //                   apparent width when the caller renders at s× (default 1 = byte-identical)
}

// Aave's erf: tanh(√π · x)
function erf(x: number): number {
  return Math.tanh(1.7724538509 * x);
}

// Mean of pos/√(R²−pos²) over [0, half] (200-step trapezoid) — normalizes the dome.
function domeIntegral(R: number, half: number): number {
  let sum = 0;
  for (let k = 0; k <= 200; k++) {
    const p = (k / 200) * half;
    const s = p / Math.sqrt(R * R - p * p);
    sum += k === 0 || k === 200 ? 0.5 * s : s;
  }
  return sum / 200;
}

export function computeDomeConstants(domeDepth: number, halfW: number, halfH: number) {
  const a = Math.max(0.01, Math.min(domeDepth, Math.min(halfW, halfH) - 1));
  const Rx = (halfW * halfW + a * a) / (2 * a);
  const Ry = (halfH * halfH + a * a) / (2 * a);
  const lx = domeIntegral(Rx, halfW);
  const ly = domeIntegral(Ry, halfH);
  return { Rx, Ry, scaleX: lx > 0 ? 0.5 / lx : 1, scaleY: ly > 0 ? 0.5 / ly : 1 };
}

function domeGradient(pos: number, R: number, scale: number): number {
  const n = Math.min(pos, 0.999 * R);
  return (n / Math.sqrt(R * R - n * n)) * scale;
}

export function renderDisplacementMap(o: GlassMapOptions): HTMLCanvasElement {
  const { radius, depth } = o;
  const dome = o.dome ?? 0;
  const edge = o.edge ?? 0;
  const glow = o.glow ?? 0;
  const shade = o.shade ?? 0;
  const margin = o.margin ?? 0;

  const cw = o.width + 2 * margin;
  const chh = o.height + 2 * margin;
  const cv = document.createElement('canvas');
  cv.width = cw;
  cv.height = chh;
  const ctx = cv.getContext('2d');
  if (!ctx) return cv;
  const img = ctx.createImageData(cw, chh);

  const halfW = o.width / 2;
  const halfH = o.height / 2;
  const S = Math.min(radius, Math.min(halfW, halfH));
  const iw = Math.max(0, halfW - depth);
  const ih = Math.max(0, halfH - depth);
  const v = Math.max(0, Math.min(radius, Math.min(iw, ih)));
  const E = depth > 0 ? 1 / (depth * Math.SQRT2) : 1e6;
  const F = dome > 0 ? computeDomeConstants(dome, halfW, halfH) : null;
  const specOn = edge > 0 || glow > 0;
  const rot = ((o.specularRotation ?? 45) * Math.PI) / 180;
  const ck = Math.cos(rot);
  const sk = Math.sin(rot);
  const glowSpread = 1;
  const glowExp = 1.5;
  const GI = (1 - glowSpread) * Math.SQRT2;
  const GT = glowSpread * Math.SQRT2;
  const edgeW = 3 * (o.pxScale ?? 1); // constant apparent width when supersampled
  const edgeExp = 1.5;

  // Writes one pixel. The sign-dependent terms (u, m, lin) are recomputed from
  // the target's own x/y so the byte output is identical to a full per-pixel
  // loop; only the shared transcendentals (dist, i, dome gradients) are passed in.
  const writePixel = (
    tr: number,
    tc: number,
    inside: boolean,
    dist: number,
    i: number,
    umag: number,
    mmag: number,
  ) => {
    const t = (tr * cw + tc) * 4;
    if (inside) {
      const x = tc + 0.5 - cw / 2;
      const y = tr + 0.5 - chh / 2;
      const u = F ? Math.sign(x) * umag : Math.max(-1, Math.min(1, x / halfW));
      const m = F ? Math.sign(y) * mmag : Math.max(-1, Math.min(1, y / halfH));
      // sample toward the interior (offsetDir = −u·i): magnification
      img.data[t] = encodeOffset(-u * i);
      img.data[t + 1] = encodeOffset(-m * i);
      if (specOn || shade > 0) {
        // Signed axis (recomputed from THIS target's x/y so the quarter-map
        // mirror lands the dark side correctly per quadrant). lit = the light-
        // facing (+45°) edge, shadow = the opposite edge.
        const linSigned =
          Math.max(-1, Math.min(1, x / halfW)) * ck + Math.max(-1, Math.min(1, y / halfH)) * sk;
        const lin = Math.abs(linSigned);
        let r = 0;
        if (glow > 0)
          r +=
            glow * Math.pow(GT > 0.001 ? Math.min(1, Math.max(0, lin - GI) / GT) : 0, glowExp) * i;
        // Rim glint: full on the lit edge; on the shadow edge it fades with
        // `shade` and then inverts into a dark occlusion rim (item 2). Because
        // one of lit/shadow is always exactly 0, this equals edge·band·|lin|^exp
        // at shade 0 (byte-identical).
        const band = Math.max(0, 1 + dist / edgeW);
        const shadow = Math.max(0, -linSigned);
        if (edge > 0) {
          r += edge * band * Math.pow(Math.max(0, linSigned), edgeExp);
          r += edge * band * (1 - shade) * Math.pow(shadow, edgeExp);
        }
        if (shade > 0) r -= shade * band * Math.pow(shadow, edgeExp);
        img.data[t + 2] = encodeSpec(r); // clamps r ∈ [−1, 1]
      } else {
        img.data[t + 2] = NEUTRAL_BYTE;
      }
    } else {
      img.data[t] = NEUTRAL_BYTE;
      img.data[t + 1] = NEUTRAL_BYTE;
      img.data[t + 2] = NEUTRAL_BYTE;
    }
    img.data[t + 3] = 255;
  };

  // Four-fold symmetry (Aave's "computing a quarter of the map"): the rounded-rect
  // map mirrors about both centre axes, so dist / erf falloff / dome gradients —
  // all functions of (|x|, |y|) — are identical across the four quadrants. Compute
  // them once per top-left pixel and mirror; X-displacement negates across the
  // vertical axis, Y across the horizontal (handled by writePixel's per-target sign).
  const halfRows = Math.ceil(chh / 2);
  const halfCols = Math.ceil(cw / 2);
  for (let row = 0; row < halfRows; row++) {
    const mrow = chh - 1 - row;
    for (let col = 0; col < halfCols; col++) {
      const mcol = cw - 1 - col;
      const gx = Math.abs(col + 0.5 - cw / 2);
      const gy = Math.abs(row + 0.5 - chh / 2);
      const M = gx - halfW + S;
      const C = gy - halfH + S;
      const Lx = Math.max(M, 0);
      const Hy = Math.max(C, 0);
      const dist = Math.sqrt(Lx * Lx + Hy * Hy) + Math.min(Math.max(M, C), 0) - S;
      const inside = dist < 0;
      let i = 0;
      let umag = 0;
      let mmag = 0;
      if (inside) {
        if (F) {
          umag = domeGradient(gx, F.Rx, F.scaleX);
          mmag = domeGradient(gy, F.Ry, F.scaleY);
        }
        const ex = gx - iw + v;
        const ey = gy - ih + v;
        const d2 =
          Math.sqrt(Math.max(ex, 0) ** 2 + Math.max(ey, 0) ** 2) +
          Math.min(Math.max(ex, ey), 0) -
          v;
        i = 0.5 * (1 + erf(d2 * E));
      }
      writePixel(row, col, inside, dist, i, umag, mmag);
      if (mcol !== col) writePixel(row, mcol, inside, dist, i, umag, mmag);
      if (mrow !== row) writePixel(mrow, col, inside, dist, i, umag, mmag);
      if (mcol !== col && mrow !== row) writePixel(mrow, mcol, inside, dist, i, umag, mmag);
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

export function buildDisplacementMap(o: GlassMapOptions): string {
  return renderDisplacementMap(o).toDataURL();
}
