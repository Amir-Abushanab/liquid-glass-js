// Framework-agnostic mount for the unified liquid-glass surface.
//
// Ported verbatim from the app's `LiquidGlass.astro` <script> so every consumer
// (vanilla / Astro / React / …) gets the same renderer selection and the same
// lazy-WebGL code-split — not just Astro. The decision tree (auto mode):
//   • `refract` element present → SVG feDisplacementMap on the LIVE DOM
//     (Aave's actual technique: content stays selectable/clickable, works in
//     every browser incl. Safari, no fallback). Wins over everything.
//   • `source` (canvas/video/img) + WebGL2 → WebGL (Path B, lazy-imported).
//   • `backdrop` (CSS background) → SVG filter on a viewport-locked clone.
//   • none / WebGL2 unavailable → frost (backdrop-filter) last resort.
//
// Colors are de-themed to package vars (with fallbacks) so no app tokens are
// assumed: `--glass-paper`, `--glass-ink` (in css/glass.css), `--glass-frost-bg`
// (here), and the caller's `backdrop`. See css/glass.css + README.

import { buildDisplacementMap } from './displacement';
import { specMaskValues } from './map-encode';
import type { GlassGL as GlassGLType } from './webgl';

const MARGIN = 28; // bleed so the displacement doesn't sample past the lens rim
const SPEC_LO = 0.25;
const SPEC_HI = 0.7;

export interface GlassOptions {
  radius?: number;
  depth?: number;
  dome?: number;
  strength?: number;
  edge?: number;
  glow?: number;
  chroma?: number;
  blur?: number;
  tint?: number;
  spec?: number;
  vibrancy?: number;
  backdrop?: string; // CSS background → SVG-clone path
  source?: HTMLElement | string; // selector or element for a canvas/video/img → WebGL path
  refract?: HTMLElement; // live-DOM element → primary SVG path
  mode?: 'auto' | 'svg' | 'webgl' | 'frost';
  class?: string;
}

export interface GlassInstance {
  dispose(): void;
}

export const GLASS_DEFAULTS = {
  radius: 22,
  depth: 20,
  dome: 14,
  strength: 16,
  edge: 0.8,
  glow: 0.2,
  chroma: 0.3,
  blur: 2,
  tint: 12,
  spec: 0.9,
  vibrancy: 0.15,
} as const;

// Resolved per-instance params handed to the mounters (mirrors the app's `P`).
interface P {
  radius: number;
  depth: number;
  dome: number;
  strength: number;
  edge: number;
  glow: number;
  chroma: number;
  blur: number;
  spec: number;
  vibrancy: number;
  backdrop: string;
  source: string;
}

// ── data-* bridge (used by the Astro adapter and any HTML-driven mount) ──
const num = (el: HTMLElement, k: string, d: number) => {
  const v = Number(el.dataset[k]);
  return Number.isNaN(v) ? d : v;
};
export function readGlassOptions(el: HTMLElement): GlassOptions {
  return {
    radius: num(el, 'radius', GLASS_DEFAULTS.radius),
    depth: num(el, 'depth', GLASS_DEFAULTS.depth),
    dome: num(el, 'dome', GLASS_DEFAULTS.dome),
    strength: num(el, 'strength', GLASS_DEFAULTS.strength),
    edge: num(el, 'edge', GLASS_DEFAULTS.edge),
    glow: num(el, 'glow', GLASS_DEFAULTS.glow),
    chroma: num(el, 'chroma', GLASS_DEFAULTS.chroma),
    blur: num(el, 'blur', GLASS_DEFAULTS.blur),
    tint: num(el, 'tint', GLASS_DEFAULTS.tint),
    spec: num(el, 'spec', GLASS_DEFAULTS.spec),
    vibrancy: num(el, 'vibrancy', GLASS_DEFAULTS.vibrancy),
    backdrop: el.dataset.backdrop || '',
    source: el.dataset.source || '',
    mode: (el.dataset.mode as GlassOptions['mode']) || 'auto',
  };
}

// Memoized once + the probe context is released immediately, so repeated
// mounts don't each leave a throwaway WebGL context alive (which can evict a
// real one — e.g. the Glass QR — under context pressure).
let _webgl2OK: boolean | undefined;
function webgl2OK(): boolean {
  if (_webgl2OK !== undefined) return _webgl2OK;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    _webgl2OK = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    _webgl2OK = false;
  }
  return _webgl2OK;
}

// ── Path A: SVG filter on a viewport-locked clone of the CSS backdrop ──
function mountSvg(el: HTMLElement, surface: HTMLElement, p: P): () => void {
  const uid = el.dataset.uid || 'g';
  const s1 = p.strength * (1 + 0.2 * p.chroma);
  const s2 = p.strength * (1 + 0.1 * p.chroma);
  const s3 = p.strength;
  surface.style.cssText =
    `position:absolute;inset:-${MARGIN}px;pointer-events:none;` +
    `background-color:var(--glass-paper, #fff);background-image:${p.backdrop};` +
    `background-position:center top;background-repeat:no-repeat;` +
    `background-attachment:fixed;background-size:cover;filter:url(#${uid})`;
  const holder = document.createElement('div');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  holder.innerHTML =
    `<svg width="0" height="0" aria-hidden="true"><filter id="${uid}" x="0" y="0" width="1" height="1" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
    `<feFlood flood-color="rgb(128,128,128)" flood-opacity="1" result="mapBg"></feFlood>` +
    `<feImage class="ps-glass__map" preserveAspectRatio="none" result="rawMap"></feImage>` +
    `<feComposite in="rawMap" in2="mapBg" operator="over" result="map"></feComposite>` +
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${p.blur}" result="blurred"></feGaussianBlur>` +
    `<feDisplacementMap in="blurred" in2="map" scale="${s1}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
    `<feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispR"></feColorMatrix>` +
    `<feDisplacementMap in="blurred" in2="map" scale="${s2}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispG"></feColorMatrix>` +
    `<feDisplacementMap in="blurred" in2="map" scale="${s3}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="dispB"></feColorMatrix>` +
    `<feComposite in="dispR" in2="dispG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"></feComposite>` +
    `<feComposite in2="dispB" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lensResult"></feComposite>` +
    `<feColorMatrix in="map" type="matrix" values="${specMaskValues()}" result="specMask"></feColorMatrix>` +
    `<feComposite in="specMask" in2="lensResult" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"></feComposite>` +
    `</filter></svg>`;
  el.appendChild(holder);
  const map = holder.querySelector('feImage')!;
  let last = '';
  const render = () => {
    const r = el.getBoundingClientRect();
    const width = Math.round(r.width);
    const height = Math.round(r.height);
    if (!width || !height) return;
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    const key = `${width}x${height}x${radius}`;
    if (key === last) return;
    last = key;
    const href = buildDisplacementMap({
      width,
      height,
      radius,
      depth: p.depth,
      dome: p.dome,
      edge: p.edge,
      glow: p.glow,
      margin: MARGIN,
    });
    map.setAttribute('href', href);
    map.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', href); // older WebKit/Gecko feImage fallback
  };
  render();
  const ro = new ResizeObserver(render);
  ro.observe(el);
  return () => {
    ro.disconnect();
    holder.remove();
  };
}

// ── Path B: WebGL, sampling a <canvas>/<video>/<img> element ──
function mountWebgl(
  el: HTMLElement,
  surface: HTMLElement,
  p: P,
  src: HTMLElement,
  isAlive: () => boolean,
  cleanups: Array<() => void>,
): void {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  surface.appendChild(canvas);
  cleanups.push(() => canvas.remove());
  void (async () => {
    let glass: GlassGLType;
    try {
      // Code-split: the WebGL renderer is fetched only when a page actually hits
      // this path, so SVG-only consumers ship none of it.
      const { GlassGL } = await import('./webgl');
      if (!isAlive()) {
        canvas.remove();
        return;
      }
      glass = new GlassGL(canvas, {
        radius: p.radius,
        depth: p.depth,
        dome: p.dome,
        strength: p.strength,
        chroma: p.chroma,
        frost: p.blur,
        spec: p.spec,
        vibrancy: p.vibrancy,
        specLo: SPEC_LO,
        specHi: SPEC_HI,
      });
    } catch {
      canvas.remove();
      el.dataset.render = 'frost'; // WebGL init failed → fell back
      cleanups.push(mountFrost(el, surface, p));
      return;
    }
    const anySrc = src as unknown as {
      videoWidth?: number;
      naturalWidth?: number;
      width?: number;
      clientWidth?: number;
      videoHeight?: number;
      naturalHeight?: number;
      height?: number;
      clientHeight?: number;
    };
    const sw = () =>
      anySrc.videoWidth || anySrc.naturalWidth || anySrc.width || anySrc.clientWidth || 1;
    const sh = () =>
      anySrc.videoHeight || anySrc.naturalHeight || anySrc.height || anySrc.clientHeight || 1;
    glass.setBackdrop(src as unknown as TexImageSource, sw(), sh());

    let visible = true;
    const io = new IntersectionObserver((es) => {
      visible = es[0].isIntersecting;
    });
    io.observe(el);
    cleanups.push(() => io.disconnect());
    let srcKey = '';
    let lensKey = '';
    const frame = () => {
      if (!isAlive()) return;
      requestAnimationFrame(frame);
      if (!visible) return;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (!cw || !ch) return;
      const sk = `${sw()}x${sh()}`;
      if (sk !== srcKey) {
        srcKey = sk;
        glass.setBackdrop(src as unknown as TexImageSource, sw(), sh());
      } else glass.updateSource(src as unknown as TexImageSource);
      const lk = `${cw}x${ch}`;
      if (lk !== lensKey) {
        lensKey = lk;
        glass.resize();
        glass.center = [cw / 2, ch / 2];
        glass.half = [cw / 2, ch / 2];
        glass.cfg.radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || p.radius;
        glass.bakeMap();
      }
      const g = el.getBoundingClientRect();
      const b = src.getBoundingClientRect();
      glass.view = { x: b.left - g.left, y: b.top - g.top, w: b.width, h: b.height };
      glass.render();
    };
    requestAnimationFrame(frame);
  })();
}

// Chromium is the only engine that supports `backdrop-filter: url()`. Where it is,
// we don't just blur the page behind the surface — we run the SAME feDisplacementMap
// over it, so a frost surface actually REFRACTS the live page (the liquid ripple,
// not a flat blur). This is the one place the library reaches for a url() backdrop
// filter, and it's gated: elsewhere it's unsupported, so we fall back to blur().
function supportsBackdropUrl(): boolean {
  try {
    return typeof CSS !== 'undefined' && CSS.supports('backdrop-filter', 'url("#a")');
  } catch {
    return false;
  }
}

// ── Frost: refracts the backdrop on Chromium; plain blur everywhere else ──
function mountFrost(el: HTMLElement, surface: HTMLElement, p: P): () => void {
  // Default derived from --glass-paper so theming one variable themes the frost
  // fallback too — a hardcoded white read as a light slab on dark themes. The
  // inner fallback matters: an unset --glass-paper would make the whole
  // color-mix() invalid at computed-value time and drop the background.
  surface.style.background =
    'var(--glass-frost-bg, color-mix(in srgb, var(--glass-paper, #fff) 55%, transparent))';

  // Fallback (Safari / Firefox): a plain frosted blur — no url() backdrop filter.
  if (!supportsBackdropUrl()) {
    const blur = Math.max(6, p.blur * 2);
    surface.style.backdropFilter = `blur(${blur}px) saturate(1.3)`;
    surface.style.setProperty('-webkit-backdrop-filter', `blur(${blur}px) saturate(1.3)`);
    return () => {
      surface.style.background = '';
      surface.style.backdropFilter = '';
      surface.style.removeProperty('-webkit-backdrop-filter');
    };
  }

  // Refractive frost (Chromium): displace the backdrop through the dome map — the
  // same optics mountDomRefract runs on live DOM, only here the filter's Source is
  // the page behind the surface. Rebuild on resize; never on move (the map depends
  // on the box, not its position). Fresh id per rebuild, matching the SVG path.
  const base = el.dataset.uid || 'g';
  const frostBlur = Math.max(2, p.blur * 2);
  const s1 = p.strength * (1 + 0.2 * p.chroma);
  const s2 = p.strength * (1 + 0.1 * p.chroma);
  const s3 = p.strength;
  let holder: HTMLElement | null = null;
  let last = '';
  let n = 0;
  const render = () => {
    const r = el.getBoundingClientRect();
    const width = Math.round(r.width);
    const height = Math.round(r.height);
    if (!width || !height) return;
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    const key = `${width}x${height}x${radius}`;
    if (key === last) return;
    last = key;
    const id = `${base}-frost-${++n}`;
    const map = buildDisplacementMap({
      width,
      height,
      radius,
      depth: p.depth,
      dome: p.dome,
      edge: p.edge,
      glow: p.glow,
    });
    const svg = document.createElement('div');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    svg.innerHTML =
      `<svg width="0" height="0" aria-hidden="true"><filter id="${id}" x="0" y="0" width="1" height="1" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
      `<feFlood flood-color="rgb(128,128,128)" flood-opacity="1" result="mapBg"></feFlood>` +
      `<feImage href="${map}" xlink:href="${map}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" result="rawMap"></feImage>` +
      `<feComposite in="rawMap" in2="mapBg" operator="over" result="map"></feComposite>` +
      `<feGaussianBlur in="SourceGraphic" stdDeviation="${frostBlur}" result="blurred"></feGaussianBlur>` +
      `<feDisplacementMap in="blurred" in2="map" scale="${s1}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
      `<feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispR"></feColorMatrix>` +
      `<feDisplacementMap in="blurred" in2="map" scale="${s2}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispG"></feColorMatrix>` +
      `<feDisplacementMap in="blurred" in2="map" scale="${s3}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="dispB"></feColorMatrix>` +
      `<feComposite in="dispR" in2="dispG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"></feComposite>` +
      `<feComposite in2="dispB" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lensResult"></feComposite>` +
      `<feColorMatrix in="map" type="matrix" values="${specMaskValues()}" result="specMask"></feColorMatrix>` +
      `<feComposite in="specMask" in2="lensResult" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"></feComposite>` +
      `</filter></svg>`;
    el.appendChild(svg);
    surface.style.backdropFilter = `url(#${id}) saturate(1.2)`;
    surface.style.setProperty('-webkit-backdrop-filter', `url(#${id}) saturate(1.2)`);
    if (holder) holder.remove();
    holder = svg;
  };
  render();
  const ro = new ResizeObserver(render);
  ro.observe(el);
  return () => {
    ro.disconnect();
    if (holder) holder.remove();
    surface.style.background = '';
    surface.style.backdropFilter = '';
    surface.style.removeProperty('-webkit-backdrop-filter');
  };
}

// ── Aave's actual path: SVG feDisplacementMap on the live child DOM ──
// The content is filtered in place, so it stays selectable/clickable and works
// in every browser (Safari included) — no WebGL, no fallback.
function mountDomRefract(el: HTMLElement, refract: HTMLElement, p: P): () => void {
  const base = el.dataset.uid || 'g';
  const s1 = p.strength * (1 + 0.2 * p.chroma);
  const s2 = p.strength * (1 + 0.1 * p.chroma);
  const s3 = p.strength;
  let holder: HTMLElement | null = null;
  let last = '';
  let n = 0;
  const render = () => {
    const r = el.getBoundingClientRect();
    const width = Math.round(r.width);
    const height = Math.round(r.height);
    if (!width || !height) return;
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    const key = `${width}x${height}x${radius}`;
    if (key === last) return; // regenerate only when the shape changes, never on move
    last = key;
    // Fresh filter id every rebuild: Safari caches filter output by id and would
    // otherwise serve the stale map (the article's "refreshing the filter cleanly").
    const id = `${base}-${++n}`;
    const map = buildDisplacementMap({
      width,
      height,
      radius,
      depth: p.depth,
      dome: p.dome,
      edge: p.edge,
      glow: p.glow,
      margin: MARGIN,
    });
    const svg = document.createElement('div');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    svg.innerHTML =
      `<svg width="0" height="0" aria-hidden="true"><filter id="${id}" x="0" y="0" width="1" height="1" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
      `<feFlood flood-color="rgb(128,128,128)" flood-opacity="1" result="mapBg"></feFlood>` +
      `<feImage href="${map}" xlink:href="${map}" preserveAspectRatio="none" result="rawMap"></feImage>` +
      `<feComposite in="rawMap" in2="mapBg" operator="over" result="map"></feComposite>` +
      `<feGaussianBlur in="SourceGraphic" stdDeviation="${p.blur}" result="blurred"></feGaussianBlur>` +
      `<feDisplacementMap in="blurred" in2="map" scale="${s1}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
      `<feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispR"></feColorMatrix>` +
      `<feDisplacementMap in="blurred" in2="map" scale="${s2}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispG"></feColorMatrix>` +
      `<feDisplacementMap in="blurred" in2="map" scale="${s3}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="dispB"></feColorMatrix>` +
      `<feComposite in="dispR" in2="dispG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"></feComposite>` +
      `<feComposite in2="dispB" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lensResult"></feComposite>` +
      `<feColorMatrix in="map" type="matrix" values="${specMaskValues()}" result="specMask"></feColorMatrix>` +
      `<feComposite in="specMask" in2="lensResult" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"></feComposite>` +
      `</filter></svg>`;
    el.appendChild(svg);
    refract.style.filter = `url(#${id})`;
    refract.style.setProperty('-webkit-filter', `url(#${id})`);
    if (holder) holder.remove();
    holder = svg;
  };
  render();
  const ro = new ResizeObserver(render);
  ro.observe(el);
  return () => {
    ro.disconnect();
    if (holder) holder.remove();
    refract.style.filter = '';
    refract.style.removeProperty('-webkit-filter');
  };
}

// Insert the chrome layers (surface / tint / rim) the wrapper doesn't provide.
// Order matches the app template: [refract?] surface tint rim [content?].
function ensureLayers(root: HTMLElement): HTMLElement {
  let surface = root.querySelector<HTMLElement>('.ps-glass__surface');
  if (surface) return surface;
  const content = root.querySelector<HTMLElement>('.ps-glass__content');
  const mk = (cls: string) => {
    const d = document.createElement('div');
    d.className = cls;
    if (content) root.insertBefore(d, content);
    else root.appendChild(d);
    return d;
  };
  surface = mk('ps-glass__surface');
  mk('ps-glass__tint');
  mk('ps-glass__rim');
  return surface;
}

/**
 * Mount a liquid-glass surface on `root`, auto-selecting the renderer.
 * Builds the internal chrome layers itself, so a wrapper only needs to provide
 * the `.ps-glass` root plus (optionally) a `.ps-glass__refract` element and a
 * `.ps-glass__content` element. Import `@liquidglassjs/core/css` for styling.
 */
export function mountGlass(root: HTMLElement, opts: GlassOptions = {}): GlassInstance {
  const o = { ...GLASS_DEFAULTS, ...opts };
  root.classList.add('ps-glass');
  if (opts.class) for (const c of opts.class.split(/\s+/).filter(Boolean)) root.classList.add(c);
  root.dataset.glass = '';
  if (!root.dataset.uid) root.dataset.uid = 'ps-glass-' + Math.random().toString(36).slice(2, 9);
  root.style.setProperty('--g-radius', `${o.radius}px`);
  root.style.setProperty('--g-tint', String(o.tint));
  root.style.setProperty('--g-margin', `${MARGIN}px`);

  const surface = ensureLayers(root);

  // Resolve the source element (selector string or a passed element).
  let sourceStr = '';
  let sourceEl: HTMLElement | null = null;
  if (typeof opts.source === 'string' && opts.source) {
    sourceStr = opts.source;
    try {
      sourceEl = document.querySelector<HTMLElement>(opts.source);
    } catch {
      sourceEl = null;
    }
  } else if (opts.source instanceof HTMLElement) {
    sourceEl = opts.source;
  }

  const p: P = {
    radius: o.radius,
    depth: o.depth,
    dome: o.dome,
    strength: o.strength,
    edge: o.edge,
    glow: o.glow,
    chroma: o.chroma,
    blur: o.blur,
    spec: o.spec,
    vibrancy: o.vibrancy,
    backdrop: opts.backdrop ?? '',
    source: sourceStr,
  };

  let disposed = false;
  const cleanups: Array<() => void> = [];
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const c of cleanups.splice(0)) {
      try {
        c();
      } catch {
        /* ignore */
      }
    }
  };
  const isAlive = () => !disposed;

  // Decision tree (identical to the app): refract wins; else source+WebGL2;
  // else backdrop → SVG clone; else frost.
  const refract = opts.refract ?? root.querySelector<HTMLElement>('.ps-glass__refract');
  if (refract) {
    root.dataset.render = 'svg';
    cleanups.push(mountDomRefract(root, refract, p));
    return { dispose };
  }

  let mode = opts.mode || 'auto';
  const canWebgl = !!sourceEl && webgl2OK();
  if (mode === 'auto') mode = canWebgl ? 'webgl' : p.backdrop ? 'svg' : 'frost';

  if (mode === 'webgl' && sourceEl && webgl2OK()) {
    root.dataset.render = 'webgl';
    mountWebgl(root, surface, p, sourceEl, isAlive, cleanups);
  } else if (mode === 'svg' && p.backdrop) {
    root.dataset.render = 'svg';
    cleanups.push(mountSvg(root, surface, p));
  } else {
    root.dataset.render = 'frost';
    cleanups.push(mountFrost(root, surface, p));
  }
  return { dispose };
}

/** Convenience for HTML/attribute-driven mounts (the Astro adapter uses this). */
export function mountGlassFromData(root: HTMLElement): GlassInstance {
  return mountGlass(root, readGlassOptions(root));
}
