// The frost lens's specular rim, restated as CSS for the frames it is suspended.
//
// mountFrost drops the url() lens while its box is resizing (the raster is the
// whole cost of a resize animation), and the plain blur standing in has no rim.
// That light edge is what reads as the glass's outline, so for those frames the
// tint layer draws it: this builds the shadows and masks, glass.css paints them.
// A generic light ring doesn't cut it. The lens's rim is directional and soft
// (a 14px glow at the lit corners, next to nothing at the other two), so a ring
// made the outline brighter at both ends of an animation than in its middle.
//
// WHAT THE LENS DRAWS (displacement.ts; frost passes no margin, shade or rotation)
//
// Map pixel k, whose centre sits k + ½ px in from the edge, holds r_k = min(1, c_k·m):
//   c_k = 2^¾·edge·band(k + ½) + glow·i(k + ½)    band(t) = 1 − t/3, i = the dome falloff
//   m   = |2p − 1|^1.5
// where p is the position along `linear-gradient(to bottom right)`. The 45° light
// axis in the box's normalised coordinates is exactly that gradient's axis: TL at 0,
// BR at 1, the other two corners on the ½ isoline, whatever the aspect. The filter
// samples the map bilinearly, so at depth t the rim is Σ hat_k(t)·r_k, and the
// spec composite adds 127/255·r of white to the backdrop.
//
// HOW IT'S REDRAWN
//
// Two layers because only pixel 0 hits the r ≤ 1 clamp. Each is one profile in
// depth (stacked inset spreads, half a pixel apart) times one mask in p. Pixel 0
// gets a clamped mask and the first 1.5px; everything deeper is plain m, the band
// as spreads and the glow as one Gaussian inset (erf-A's slope makes σ = 0.6366·depth).
//
// There's no additive blend to lean on: `mix-blend-mode` on any layer inside the
// glass makes its stacking context an isolated group, which Chromium then treats
// as the backdrop root. The frost stops seeing the page and the blur vanishes
// (measured: the hero text showed through sharp). So the layers composite
// normally, adding a·(1 − under) where the lens adds a and clips at white. Where
// the page leaves headroom that's the same light; over pale paper the lens runs
// out of headroom within 5% and its glow turns into an even haze. `headroom` is
// 1 / (1 − paper luminance), and each layer draws min(1, headroom·a), split into
// a clipped profile and a clipped mask. That is exact wherever nothing clips.

import type { MapProfile } from './displacement';

export interface FrostGlint {
  rim: string;
  rimMask: string;
  body: string;
  bodyMask: string;
}

const K = 127 / 255;
const L = 2 ** 0.75;
const STOPS = 20;

const f4 = (v: number) => +v.toFixed(4);
// Gaussian CDF (tanh form, within 2e-4) and density.
const Phi = (x: number) => 0.5 * (1 + Math.tanh(0.7978845608 * x * (1 + 0.044715 * x * x)));
const phi = (x: number) => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
const PhiInv = (y: number) => {
  let lo = -8;
  let hi = 8;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (Phi(mid) < y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

// A mask along the light axis: f(m) at 21 stops of p.
const axisMask = (f: (m: number) => number) =>
  `linear-gradient(to bottom right, ${Array.from({ length: STOPS + 1 }, (_, i) => {
    const p = i / STOPS;
    const a = Math.min(1, Math.max(0, f(Math.abs(2 * p - 1) ** 1.5)));
    return `rgb(0 0 0 / ${f4(a)}) ${f4(p * 100)}%`;
  }).join(', ')})`;

// Inset spreads stack from the edge in: the slice j (spread from + (j+1)/2) shows
// 1 − Π_{i≥j}(1 − α_i), so solve innermost-out for each shadow's own alpha.
const slices = (want: number[], from: number) => {
  const a = want.map((v) => Math.min(1, Math.max(0, v)));
  return a.map((v, j) => {
    const below = a[j + 1] ?? 0;
    const own = below >= 1 ? 0 : Math.max(0, 1 - (1 - v) / (1 - below));
    return `inset 0 0 0 ${f4(from + (j + 1) / 2)}px rgb(255 255 255 / ${f4(own)})`;
  });
};

export function frostGlint(
  p: { edge: number; glow: number; depth: number; profile: MapProfile },
  headroom: number,
): FrostGlint {
  const { edge, glow, depth, profile } = p;
  const S = headroom * K;
  const band = (t: number) => Math.max(0, 1 - t / 3);
  const dome = (t: number) =>
    profile === 'circle'
      ? 1 - Math.sqrt(1 - Math.max(0, 1 - t / depth) ** 2)
      : 0.5 * (1 + Math.tanh((1.7724538509 * (depth - t)) / (depth * Math.SQRT2)));
  const c = (k: number) => L * edge * band(k + 0.5) + glow * dome(k + 0.5);
  const hat = (k: number, t: number) =>
    k === 0 && t <= 0.5 ? 1 : Math.max(0, 1 - Math.abs(t - (k + 0.5)));
  const mid = (j: number) => j / 2 + 0.25;
  const c0 = c(0);
  const c1 = c(1);
  // edge 0 and glow 0: the map carries no spec, so there is no rim to stand in for.
  if (!(c0 > 0)) return { rim: 'none', rimMask: 'none', body: 'none', bodyMask: 'none' };

  // Pixel 0 over its hat, plus pixel 1's share of the middle slice (proportional
  // to m there, which pixel 0's mask matches wherever pixel 0 isn't clamped).
  const rim = slices(
    [0, 1, 2].map((j) =>
      Math.min(1, S * (hat(0, mid(j)) * c0 + (j === 1 ? hat(1, mid(j)) * c1 : 0))),
    ),
    0,
  ).join(', ');
  const G0 = S * c0;
  const rimMask = axisMask((m) => Math.min(1, S * Math.min(1, c0 * m)) / Math.min(1, G0));

  // Pixels 1+ from 1px in (glass.css masks the outer pixel off this layer). The
  // glow shadow is a·Φ((centre − t)/σ) clipped at 1: past a = 1 its half-point
  // and slope are refit, so the clipped shoulder still lands where it should.
  const sigma = profile === 'circle' ? 0.2303 * depth : 0.6366 * depth;
  const centre = profile === 'circle' ? 0.134 * depth : depth;
  const a = S * glow;
  let gAlpha = Math.min(1, a);
  let gSpread = centre;
  let gSigma = sigma;
  if (a > 1) {
    const xh = PhiInv(0.5 / a);
    gSpread = centre - sigma * xh;
    gSigma = (sigma * phi(0)) / (a * phi(xh));
  }
  const g = (t: number) => (glow > 0 ? gAlpha * (1 - Phi((t - gSpread) / gSigma)) : 0);
  const want: number[] = [];
  for (let j = 2; mid(j) < 3.5; j++) {
    const t = mid(j);
    let r = 0;
    for (let k = 1; k <= 4; k++) r += hat(k, t) * c(k);
    const gt = g(t);
    want.push(gt >= 1 ? 0 : 1 - (1 - Math.min(1, S * r)) / (1 - gt));
  }
  const body = [
    ...slices(want, 1),
    ...(glow > 0
      ? [
          `inset 0 0 ${f4(2 * gSigma)}px ${f4(Math.max(0, gSpread))}px rgb(255 255 255 / ${f4(gAlpha)})`,
        ]
      : []),
  ].join(', ');
  // One mask for band and glow: anchored on the glow halfway in, since that is
  // what spreads the light in when it clips; the band clips sooner regardless.
  const Gb = S * (glow > 0 ? glow * dome(depth / 2) : 0.75 * c1);
  const bodyMask =
    axisMask((m) => Math.min(1, Gb * Math.min(m, 1 / c1)) / Math.min(1, Gb)) +
    ', linear-gradient(#000 0 0)';
  return { rim, rimMask, body, bodyMask };
}
