// Glyph-shaped liquid-glass displacement map.
//
// Rasterizes a line of text to a canvas, blurs the coverage into a height
// field, and differentiates it into the same encoding displacement.ts emits
// for the rounded-rect lens:
//   R = X-displacement, G = Y-displacement (128 = no shift; the filter samples
//       up-gradient, toward the stroke interior = magnification, so it never
//       pulls transparent pixels from outside the glyph)
//   B = directional rim specular (128 = none), lit along the same 45° axis as
//       the lens's default specularRotation
// Alpha is 255 everywhere so premultiplied filter pipelines can't distort the
// channels. The map is generated at up to 2× device resolution and the
// <feImage> scales it back to CSS px (supersampled field).

import { encodeOffset, encodeSpec } from './map-encode';

export interface GlyphMapOptions {
  text: string;
  rectW: number; // target border-box, CSS px
  rectH: number;
  baseline: number; // alphabetic baseline offset from border-box top, CSS px
  // Where the text starts across, from the border-box left. Everything else here is
  // measured against the border box, and the glyphs are not: they begin at the content
  // box. Zero for an unpadded target, and padding a glass heading is the ordinary way
  // to keep `background-clip: text` from cutting its descenders, so this is not an
  // edge case — miss it and the whole map is drawn one padding to the left of the
  // letters it is supposed to be shaped like.
  padLeft?: number;
  fontCss: string; // canvas font shorthand composed from computed longhands
  letterSpacing: string; // computed letter-spacing px string ('' = normal)
  fontSizePx: number;
  dpr: number;
  bevel: number; // rim width: sigma of the glyph-coverage blur, CSS px
  dome: number; // interior meniscus swell: wide-field mix, 0–12
  edge: number; // rim glint strength
  glow: number; // soft wide sheen strength
  shade?: number; // dark occlusion rim opposite the glint (0–1, default 0)
}

export interface GlyphMap {
  url: string;
  margin: number; // CSS px of neutral padding baked around the rect
  cssW: number; // feImage size in CSS px (device size / dpr, so the ceil()
  cssH: number; // remainder accrues at the right/bottom, not as a shift)
}

// Reusable buffers, owned by the caller (one per mounted instance) so slider
// drags reallocate nothing; arrays are keyed to the current device dimensions.
export interface GlyphMapCache {
  canvas?: HTMLCanvasElement;
  img?: ImageData;
  hn?: Float32Array; // narrow height field (blurred coverage)
  hw?: Float32Array; // wide height field
  tmp?: Float32Array; // blur scratch
  w?: number;
  h?: number;
}

// Box sizes whose 3-pass composition approximates a Gaussian of the given sigma.
function boxesForGauss(sigma: number): number[] {
  const n = 3;
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
  const m = Math.round(mIdeal);
  const sizes: number[] = [];
  for (let i = 0; i < n; i++) sizes.push(i < m ? wl : wu);
  return sizes;
}

// Sliding-window box blurs, zero-padded at the buffer edges (outside the
// canvas there truly is no ink; clamp-edge would smear border values inward).
function boxBlurH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let x = 0; x <= r && x < w; x++) acc += src[row + x];
    for (let x = 0; x < w; x++) {
      dst[row + x] = acc * norm;
      const add = x + r + 1;
      const sub = x - r;
      if (add < w) acc += src[row + add];
      if (sub >= 0) acc -= src[row + sub];
    }
  }
}

function boxBlurV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const norm = 1 / (2 * r + 1);
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = 0; y <= r && y < h; y++) acc += src[y * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = acc * norm;
      const add = y + r + 1;
      const sub = y - r;
      if (add < h) acc += src[add * w + x];
      if (sub >= 0) acc -= src[sub * w + x];
    }
  }
}

// In-place 3-pass approximate Gaussian (deterministic across browsers, unlike
// ctx.filter, which older Safari lacks).
function gaussBlur(data: Float32Array, tmp: Float32Array, w: number, h: number, sigma: number) {
  if (sigma <= 0) return;
  for (const size of boxesForGauss(sigma)) {
    const r = (size - 1) / 2;
    if (r < 1) continue;
    boxBlurH(data, tmp, w, h, r);
    boxBlurV(tmp, data, w, h, r);
  }
}

// Options for the shape-agnostic core. `draw(ctx, margin)` paints opaque
// coverage in CSS px — the ctx arrives pre-scaled by dpr and pre-cleared, with
// the content box's top-left at (margin, margin). Everything after rasterization
// (blur → gradient → encode) is identical for text, SVG, images, or a raw
// canvas, which is exactly what makes glass-anything possible (item 1).
export interface AlphaMapOptions {
  rectW: number; // content border box, CSS px
  rectH: number;
  dpr: number;
  bevel: number; // rim width (coverage-blur sigma), CSS px
  dome: number; // interior meniscus swell
  edge: number; // rim glint
  glow: number; // soft wide sheen
  shade?: number; // dark occlusion rim (item 2)
  marginBoost?: number; // extra neutral padding beyond 3·bevel (text passes 0.2·fontSize)
  draw: (ctx: CanvasRenderingContext2D, margin: number) => void;
}

export function buildAlphaDisplacementMap(o: AlphaMapOptions, cache: GlyphMapCache = {}): GlyphMap {
  // Margin covers the outward half of the bevel ramp AND any ink overflowing the
  // content box (text passes marginBoost = 0.2·fontSize for ascent/descent bleed).
  const margin = Math.ceil(Math.max(3 * o.bevel, o.marginBoost ?? 0)) + 2;
  const w = Math.max(1, Math.ceil((o.rectW + 2 * margin) * o.dpr));
  const h = Math.max(1, Math.ceil((o.rectH + 2 * margin) * o.dpr));

  if (!cache.canvas) cache.canvas = document.createElement('canvas');
  const cv = cache.canvas;
  if (cache.w !== w || cache.h !== h) {
    cv.width = w;
    cv.height = h;
    cache.w = w;
    cache.h = h;
    cache.img = undefined;
    cache.hn = new Float32Array(w * h);
    cache.hw = new Float32Array(w * h);
    cache.tmp = new Float32Array(w * h);
  }
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { url: '', margin, cssW: w / o.dpr, cssH: h / o.dpr };

  // ── rasterize opaque coverage (the draw closure works in CSS px) ──
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  o.draw(ctx, margin);

  // ── height fields: narrow rim + wide meniscus (Gaussian composition) ──
  const src = ctx.getImageData(0, 0, w, h).data;
  const hn = cache.hn!;
  const hw = cache.hw!;
  const tmp = cache.tmp!;
  const N = w * h;
  for (let i = 0; i < N; i++) hn[i] = src[i * 4 + 3] / 255;

  // ── how thick is the ink? ─────────────────────────────────────────────────────
  //
  // `bevel` is a Gaussian sigma in px, but a stroke's width is not. The same 1.3px
  // rim that reads as a highlight down a 24px display stem swallows a 3px one whole,
  // and a stroke with no flat core left is ALL rim: every pixel is a gradient, so the
  // edge glint and the sheen fire across the whole glyph and it washes out to a
  // ghost. That is what makes one bevel look wrong at another weight, family or size
  // — the parameter is absolute and the artwork is not.
  //
  // Mean stroke width falls out of the coverage for free. For a stroke-like shape
  // area ≈ width × length and total variation ≈ perimeter ≈ 2 × length, so
  // width ≈ 2·area/TV. Exact for an axis-aligned bar, about √2 low on 45° diagonals,
  // which errs toward a thinner rim — the safe direction.
  let area = 0;
  let tv = 0;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const a = hn[row + x];
      area += a;
      if (x + 1 < w) tv += Math.abs(a - hn[row + x + 1]);
      if (y + 1 < h) tv += Math.abs(a - hn[row + w + x]);
    }
  }
  const strokePx = tv > 1e-6 ? (2 * area) / tv : 0;

  // Hold the rim to a fraction of that. Blurring a stem of width W by W/3 leaves its
  // centre at erf(3/(2√2)) ≈ 0.86 — still a distinct interior for the dome to swell
  // and for the glint to run around — while W/8 is thin enough to still read as an
  // edge rather than a hairline. Between those two `bevel` is honoured exactly, so
  // artwork that was already in proportion is untouched; it only bites where the
  // requested rim was going to eat the stroke or vanish against it.
  //
  // The upper bound also can't outrun the raster: the margin was sized for 3·bevel,
  // and a sigma wider than margin/3 would have its ramp clipped at the edge.
  const want = Math.max(0.5, o.bevel * o.dpr);
  const hi = strokePx > 0 ? Math.min(strokePx / 3, (margin * o.dpr) / 3) : want;
  const lo = Math.min(strokePx / 8, hi);
  const sn = Math.max(0.5, Math.min(Math.max(want, lo), hi));
  gaussBlur(hn, tmp, w, h, sn);
  hw.set(hn);
  gaussBlur(hw, tmp, w, h, sn * Math.sqrt(8)); // total sigma = 3·sn

  // ── differentiate into the displacement + specular encoding ──
  if (!cache.img) cache.img = ctx.createImageData(w, h);
  const out = cache.img.data;
  // Peak derivative of a Gaussian-blurred step is 1/(σ√2π); scaling by σ√2π
  // makes the field peak at ±1 regardless of bevel, so strength stays in px.
  const nrmN = sn * Math.sqrt(2 * Math.PI);
  const nrmW = 3 * sn * Math.sqrt(2 * Math.PI);
  const domeMix = o.dome / 6;
  const shade = o.shade ?? 0;
  const SQ2 = Math.SQRT1_2; // cos 45° = sin 45°
  for (let y = 0; y < h; y++) {
    const ymRow = (y > 0 ? y - 1 : y) * w;
    const ypRow = (y < h - 1 ? y + 1 : y) * w;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      const xm = x > 0 ? i - 1 : i;
      const xp = x < w - 1 ? i + 1 : i;
      // central differences, pointing toward higher coverage (into the stroke)
      const gxN = (hn[xp] - hn[xm]) / 2;
      const gyN = (hn[ypRow + x] - hn[ymRow + x]) / 2;
      const gxW = (hw[xp] - hw[xm]) / 2;
      const gyW = (hw[ypRow + x] - hw[ymRow + x]) / 2;
      const u = Math.max(-1, Math.min(1, (gxN + domeMix * gxW) * nrmN));
      const v = Math.max(-1, Math.min(1, (gyN + domeMix * gyW) * nrmN));
      const t = i * 4;
      // offsetDir = +u/+v: up-gradient = magnify, matching the lens's convention.
      out[t] = encodeOffset(u);
      out[t + 1] = encodeOffset(v);
      // rim specular: gradient-magnitude band, brightest on 45°-facing edges
      let r = 0;
      const magN = Math.hypot(gxN, gyN);
      if (magN > 1e-6) {
        // Rim glint: full on the light-facing (+45°) edge; on the opposite edge
        // it fades with `shade` and inverts into a dark rim (item 2). One of
        // lit/shadow is always 0, so at shade 0 this is edge·band·|lin|
        // (byte-identical).
        const linSigned = ((gxN + gyN) / magN) * SQ2;
        const bandE = Math.pow(Math.min(1, magN * nrmN), 1.5);
        const shadow = Math.max(0, -linSigned);
        r = o.edge * bandE * Math.max(0, linSigned) + o.edge * bandE * (1 - shade) * shadow;
        const magW = Math.hypot(gxW, gyW);
        if (magW > 1e-6) {
          const linW = Math.abs((gxW + gyW) / magW) * SQ2;
          const bandW = Math.min(1, magW * nrmW);
          r += o.glow * Math.pow(bandW, 1.5) * linW;
        }
        if (shade > 0) r -= shade * bandE * shadow;
      }
      out[t + 2] = encodeSpec(r); // clamps r ∈ [−1, 1]
      out[t + 3] = 255;
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.putImageData(cache.img, 0, 0);
  return { url: cv.toDataURL(), margin, cssW: w / o.dpr, cssH: h / o.dpr };
}

let inkScratch: CanvasRenderingContext2D | null = null;

/**
 * How far the glyphs reach outside the element's own box, per side, in CSS px.
 *
 * The map has to cover the ink, and a line box does not: a font's ascent and descent
 * are its own business and routinely exceed `line-height`. This used to be a flat
 * 0.2em, which is fine for the mono and sans faces it was measured on and wrong for
 * anything with reach — a script face at 57.6px wants 22px below the box against a
 * 19px margin, and the tails of its descenders get cut off square.
 *
 * Measured at the size the caller is rasterizing at, which is not necessarily the one
 * CSS reports — see fontScale in glass-text.
 */
function inkOverflow(o: GlyphMapOptions): number {
  try {
    if (!inkScratch) inkScratch = document.createElement('canvas').getContext('2d');
    const ctx = inkScratch;
    if (!ctx) return 0;
    const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
    if ('letterSpacing' in (ctx as object)) c.letterSpacing = o.letterSpacing || '0px';
    ctx.font = o.fontCss;
    const m = ctx.measureText(o.text);
    // Older engines don't report the ink box; the em-based guess is the fallback.
    if (typeof m.actualBoundingBoxAscent !== 'number') return 0;
    return Math.max(
      m.actualBoundingBoxAscent - o.baseline, // above the box top
      m.actualBoundingBoxDescent - (o.rectH - o.baseline), // below the bottom
      m.actualBoundingBoxLeft - (o.padLeft ?? 0), // left of the text origin
      m.actualBoundingBoxRight + (o.padLeft ?? 0) - o.rectW, // past the advance
    );
  } catch {
    return 0;
  }
}

// Text is one draw closure over the shared core: `fillText` into the pre-scaled
// ctx at the baseline, with the letter-spacing feature-detect.
export function buildGlyphDisplacementMap(o: GlyphMapOptions, cache: GlyphMapCache = {}): GlyphMap {
  return buildAlphaDisplacementMap(
    {
      rectW: o.rectW,
      rectH: o.rectH,
      dpr: o.dpr,
      bevel: o.bevel,
      dome: o.dome,
      edge: o.edge,
      glow: o.glow,
      shade: o.shade,
      // 0.2em stays as a floor so a face that reports no ink box still gets the old
      // behaviour; 2px of slack keeps the outer end of the bevel ramp inside too.
      marginBoost: Math.max(0.2 * o.fontSizePx, inkOverflow(o) + 2),
      draw: (ctx, margin) => {
        ctx.font = o.fontCss;
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#fff';
        const bx = margin + (o.padLeft ?? 0);
        const by = margin + o.baseline;
        // ctx.letterSpacing shipped later than the rest (and TS 5.3's lib.dom lacks
        // it) — feature-detect on a cast expression (not `ctx` directly, or newer
        // lib.dom narrows the else branches to `never`), else advance per character.
        const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
        const supportsLetterSpacing = 'letterSpacing' in (ctx as object);
        if (supportsLetterSpacing) {
          c.letterSpacing = o.letterSpacing || '0px';
          ctx.fillText(o.text, bx, by);
        } else if (o.letterSpacing) {
          const lsPx = parseFloat(o.letterSpacing) || 0;
          let x = bx;
          for (const ch of o.text) {
            ctx.fillText(ch, x, by);
            x += ctx.measureText(ch).width + lsPx;
          }
        } else {
          ctx.fillText(o.text, bx, by);
        }
      },
    },
    cache,
  );
}
