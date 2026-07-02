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

export interface GlyphMapOptions {
  text: string;
  rectW: number; // target border-box, CSS px
  rectH: number;
  baseline: number; // alphabetic baseline offset from border-box top, CSS px
  fontCss: string; // canvas font shorthand composed from computed longhands
  letterSpacing: string; // computed letter-spacing px string ('' = normal)
  fontSizePx: number;
  dpr: number;
  bevel: number; // rim width: sigma of the glyph-coverage blur, CSS px
  dome: number; // interior meniscus swell: wide-field mix, 0–12
  edge: number; // rim glint strength
  glow: number; // soft wide sheen strength
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

export function buildGlyphDisplacementMap(o: GlyphMapOptions, cache: GlyphMapCache = {}): GlyphMap {
  // Margin covers the outward half of the bevel ramp AND ink overflowing the
  // border box (mono ascent+descent ≈ 1.2em vs line-height 1.04/1.1).
  const margin = Math.ceil(Math.max(3 * o.bevel, 0.2 * o.fontSizePx)) + 2;
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

  // ── rasterize the glyph coverage (work in CSS px under a dpr transform) ──
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  ctx.font = o.fontCss;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  const bx = margin;
  const by = margin + o.baseline;
  // ctx.letterSpacing shipped later than the rest (and TS 5.3's lib.dom lacks
  // it) — feature-detect, else advance per character by hand.
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  // Feature-detect on a cast expression, not `ctx` directly: newer lib.dom types
  // letterSpacing as always-present, so `'letterSpacing' in ctx` as a guard would
  // control-flow-narrow the else branches to `never`. Casting the `in` subject
  // breaks that narrowing chain while keeping the runtime check identical.
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

  // ── height fields: narrow rim + wide meniscus (Gaussian composition) ──
  const src = ctx.getImageData(0, 0, w, h).data;
  const hn = cache.hn!;
  const hw = cache.hw!;
  const tmp = cache.tmp!;
  const N = w * h;
  for (let i = 0; i < N; i++) hn[i] = src[i * 4 + 3] / 255;
  const sn = Math.max(0.5, o.bevel * o.dpr);
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
      // R/G > 128 samples rightward/downward: up-gradient = magnify, matching
      // the lens's sign convention.
      out[t] = Math.round((0.5 + 0.5 * u) * 255);
      out[t + 1] = Math.round((0.5 + 0.5 * v) * 255);
      // rim specular: gradient-magnitude band, brightest on 45°-facing edges
      let r = 0;
      const magN = Math.hypot(gxN, gyN);
      if (magN > 1e-6) {
        const lin = Math.abs((gxN + gyN) / magN) * SQ2;
        const band = Math.min(1, magN * nrmN);
        r = o.edge * Math.pow(band, 1.5) * lin;
        const magW = Math.hypot(gxW, gyW);
        if (magW > 1e-6) {
          const linW = Math.abs((gxW + gyW) / magW) * SQ2;
          const bandW = Math.min(1, magW * nrmW);
          r += o.glow * Math.pow(bandW, 1.5) * linW;
        }
        if (r > 1) r = 1;
      }
      out[t + 2] = Math.round(127 * r + 128);
      out[t + 3] = 255;
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.putImageData(cache.img, 0, 0);
  return { url: cv.toDataURL(), margin, cssW: w / o.dpr, cssH: h / o.dpr };
}
