// Liquid-glass letterforms — the text analog of glass-lens.ts.
//
// The glyphs are rasterized into a displacement map shaped like the text
// (glyph-map.ts, same channel encoding displacement.ts emits for the lens)
// and fed through the same SVG filter chain: feImage map → 3× chroma-split
// feDisplacementMap (R/G selectors) → B-channel specular composite → clipped
// back to SourceAlpha so the silhouette stays crisp. Live DOM: the text stays
// selectable, and every map regeneration gets a fresh filter id (Safari
// caches filter output by id).
//
// strength/chroma/blur only touch filter attributes (cheap, Safari-safe, no
// id churn — svg-ripple animates the same attrs per frame); bevel/dome/edge/
// glow regenerate the map, coalesced through one rAF per frame.

import { buildGlyphDisplacementMap, type GlyphMapCache } from './glyph-map';

export interface GlassTextParams {
  strength: number; // refraction reach, px
  chroma: number; // per-channel split, 0–1
  blur: number; // pre-blur of the fill (frost), px
  bevel: number; // rim width (glyph-coverage blur), px
  dome: number; // interior meniscus swell, 0–12
  edge: number; // rim glint strength
  glow: number; // soft wide sheen strength
}

export interface GlassTextOptions extends Partial<GlassTextParams> {
  target: HTMLElement; // the text element to refract (receives filter:url())
  host: HTMLElement; // where the <svg> filter node is appended
}

export interface GlassText {
  reconfigure(patch: Partial<GlassTextParams>): void;
  getOptions(): GlassTextParams;
  dispose(): void;
}

export const GLASS_TEXT_DEFAULTS: GlassTextParams = {
  strength: 8,
  chroma: 0.4,
  blur: 0.3,
  bevel: 2.5,
  dome: 4,
  edge: 0.9,
  glow: 0.35,
};

const PARAM_KEYS = ['strength', 'chroma', 'blur', 'bevel', 'dome', 'edge', 'glow'] as const;
const MAP_KEYS = ['bevel', 'dome', 'edge', 'glow'] as const;
const NEUTRAL = 0.5019607843137255; // 128/255, the map's "no shift / no glint" level

// Every mounted instance registers here so one control surface (the showcase
// Tuner) can drive all of them. sharedOverrides replays the last global patch
// onto instances that mount later — the Tuner's sessionStorage restore runs at
// page-script eval, before fonts.ready lets any instance mount.
const instances = new Set<GlassText>();
export const glassTextInstances: ReadonlySet<GlassText> = instances;
let sharedOverrides: Partial<GlassTextParams> = {};

export function reconfigureAllGlassText(patch: Partial<GlassTextParams>): void {
  Object.assign(sharedOverrides, patch);
  instances.forEach((g) => g.reconfigure(patch));
}

interface Measured {
  text: string;
  rectW: number;
  rectH: number;
  baseline: number;
  fontCss: string;
  letterSpacing: string;
  fontSizePx: number;
}

export function mountGlassText(o: GlassTextOptions): GlassText {
  const base = 'gtext-' + Math.random().toString(36).slice(2, 8);
  const explicit: Partial<GlassTextParams> = {};
  PARAM_KEYS.forEach((k) => {
    if (o[k] != null) explicit[k] = o[k];
  });
  const cur: GlassTextParams = { ...GLASS_TEXT_DEFAULTS, ...explicit, ...sharedOverrides };

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cache: GlyphMapCache = {};
  let n = 0;
  let raf = 0;
  let tid = 0;
  let disposed = false;
  let holder: HTMLElement | null = null;
  let dispNodes: SVGFEDisplacementMapElement[] = [];
  let blurNode: SVGFEGaussianBlurElement | null = null;
  let ro: ResizeObserver | null = null;
  let m: Measured | null = null;

  const scales = () => [cur.strength * (1 + 0.2 * cur.chroma), cur.strength * (1 + 0.1 * cur.chroma), cur.strength];

  const measure = () => {
    const el = o.target;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      m = null;
      return;
    }
    const cs = getComputedStyle(el);
    const fontSizePx = parseFloat(cs.fontSize) || 16;
    // Compose from longhands — the computed `font` shorthand is empty in Firefox.
    const fontCss = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    // Exact CSS baseline: an empty inline-block's baseline is its bottom edge,
    // so this reads whatever strut/metric logic the browser actually used.
    const probe = document.createElement('span');
    probe.style.cssText = 'display:inline-block;width:0;height:0;padding:0;border:0;margin:0';
    el.appendChild(probe);
    let baseline = probe.getBoundingClientRect().bottom - rect.top;
    probe.remove();
    if (!(baseline > 0) || baseline > rect.height + fontSizePx) {
      // fallback: font metrics + half-leading
      const scratch = document.createElement('canvas').getContext('2d');
      if (scratch) {
        scratch.font = fontCss;
        const mt = scratch.measureText('Hg');
        const asc = mt.fontBoundingBoxAscent ?? fontSizePx * 0.8;
        const desc = mt.fontBoundingBoxDescent ?? fontSizePx * 0.2;
        baseline = (rect.height - (asc + desc)) / 2 + asc;
      } else {
        baseline = rect.height * 0.8;
      }
    }
    m = {
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      rectW: rect.width,
      rectH: rect.height,
      baseline,
      fontCss,
      letterSpacing: cs.letterSpacing === 'normal' ? '' : cs.letterSpacing,
      fontSizePx,
    };
  };

  const applyAttrs = () => {
    if (!dispNodes.length) return;
    const s = scales();
    dispNodes.forEach((d, i) => d.setAttribute('scale', String(s[i])));
    blurNode?.setAttribute('stdDeviation', String(cur.blur));
  };

  const regen = () => {
    if (disposed || !m || !m.text) return;
    const map = buildGlyphDisplacementMap(
      { ...m, dpr, bevel: cur.bevel, dome: cur.dome, edge: cur.edge, glow: cur.glow },
      cache,
    );
    if (!map.url) return;
    const id = `${base}-${++n}`; // fresh id on every map change (Safari cache bust)
    const [s1, s2, s3] = scales();
    const pad = 16;
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    div.innerHTML =
      `<svg width="0" height="0" aria-hidden="true"><filter id="${id}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x="${-pad}" y="${-pad}" width="${m.rectW + 2 * pad}" height="${m.rectH + 2 * pad}" color-interpolation-filters="sRGB">` +
      `<feFlood flood-color="rgb(128,128,128)" flood-opacity="1" result="mapBg"></feFlood>` +
      `<feImage href="${map.url}" xlink:href="${map.url}" x="${-map.margin}" y="${-map.margin}" width="${map.cssW}" height="${map.cssH}" preserveAspectRatio="none" result="rawMap"></feImage>` +
      `<feComposite in="rawMap" in2="mapBg" operator="over" result="map"></feComposite>` +
      `<feGaussianBlur in="SourceGraphic" stdDeviation="${cur.blur}" result="blurred"></feGaussianBlur>` +
      `<feDisplacementMap in="blurred" in2="map" scale="${s1}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
      `<feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispR"></feColorMatrix>` +
      `<feDisplacementMap in="blurred" in2="map" scale="${s2}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispG"></feColorMatrix>` +
      `<feDisplacementMap in="blurred" in2="map" scale="${s3}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="dispB"></feColorMatrix>` +
      `<feComposite in="dispR" in2="dispG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"></feComposite>` +
      `<feComposite in2="dispB" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="refr"></feComposite>` +
      `<feColorMatrix in="map" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 1 0 -${NEUTRAL}" result="specMask"></feColorMatrix>` +
      `<feComposite in="specMask" in2="refr" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lit"></feComposite>` +
      // Clip AFTER the specular add: the outer half of the rim glint is
      // discarded on purpose — inward-biased bevel light, crisp silhouette,
      // no halo bleeding onto whatever sits behind the text.
      `<feComposite in="lit" in2="SourceAlpha" operator="in"></feComposite>` +
      `</filter></svg>`;
    o.host.appendChild(div);
    o.target.style.filter = `url(#${id})`;
    o.target.style.setProperty('-webkit-filter', `url(#${id})`);
    if (holder) holder.remove();
    holder = div;
    dispNodes = Array.from(div.querySelectorAll('feDisplacementMap'));
    blurNode = div.querySelector('feGaussianBlur');
  };

  const scheduleRegen = () => {
    if (raf || disposed) return;
    const flush = () => {
      raf = 0;
      if (tid) {
        clearTimeout(tid);
        tid = 0;
      }
      regen();
    };
    raf = requestAnimationFrame(flush);
    // rAF freezes entirely on hidden tabs — the timeout keeps a deferred
    // regen from parking there unapplied (throttled to ~1s when hidden).
    tid = window.setTimeout(() => {
      if (raf) {
        cancelAnimationFrame(raf);
        flush();
      }
    }, 150);
  };

  const init = async () => {
    try {
      await document.fonts.ready; // canvas needs the final glyph metrics
    } catch {
      /* older engines: measure with whatever is loaded */
    }
    if (disposed) return;
    measure();
    regen();
    ro = new ResizeObserver(() => {
      if (disposed) return;
      const r = o.target.getBoundingClientRect();
      if (m && Math.abs(r.width - m.rectW) < 0.5 && Math.abs(r.height - m.rectH) < 0.5) return;
      measure();
      scheduleRegen();
    });
    ro.observe(o.target);
  };
  void init();

  const handle: GlassText = {
    reconfigure(patch) {
      Object.assign(cur, patch);
      if (MAP_KEYS.some((k) => patch[k] != null)) scheduleRegen();
      else applyAttrs();
    },
    getOptions() {
      return { ...cur };
    },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      if (tid) clearTimeout(tid);
      ro?.disconnect();
      holder?.remove();
      o.target.style.filter = '';
      o.target.style.removeProperty('-webkit-filter');
      instances.delete(handle);
    },
  };
  instances.add(handle);
  return handle;
}
