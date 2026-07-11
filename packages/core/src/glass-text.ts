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

import { buildGlyphDisplacementMap } from './glyph-map';
import { mountAlphaGlass } from './mount-alpha-glass';

export interface GlassTextParams {
  strength: number; // refraction reach, px
  chroma: number; // per-channel split, 0–1
  blur: number; // pre-blur of the fill (frost), px
  bevel: number; // rim width (glyph-coverage blur), px
  dome: number; // interior meniscus swell, 0–12
  edge: number; // rim glint strength
  glow: number; // soft wide sheen strength
  shade: number; // dark occlusion rim opposite the glint (0–1, default 0)
}

export interface GlassTextOptions extends Partial<GlassTextParams> {
  target: HTMLElement; // the text element to refract (receives filter:url())
  host: HTMLElement; // where the <svg> filter node is appended
  glint?: string; // CSS colour for the specular glint (default white)
  onReady?: () => void; // fired once, after the filter first lands (soften the pop-in, item 5)
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
  shade: 0,
};

const PARAM_KEYS = [
  'strength',
  'chroma',
  'blur',
  'bevel',
  'dome',
  'edge',
  'glow',
  'shade',
] as const;

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

interface TextMeasured {
  text: string;
  rectW: number;
  rectH: number;
  baseline: number;
  fontCss: string;
  letterSpacing: string;
  fontSizePx: number;
}

export function mountGlassText(o: GlassTextOptions): GlassText {
  const explicit: Partial<GlassTextParams> = {};
  PARAM_KEYS.forEach((k) => {
    if (o[k] != null) explicit[k] = o[k];
  });
  const params: GlassTextParams = { ...GLASS_TEXT_DEFAULTS, ...explicit, ...sharedOverrides };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Text-specific measure: rect + baseline + the canvas font shorthand. Returns
  // null when there is nothing to render (this is the old `!m.text` guard).
  const measure = (): TextMeasured | null => {
    const el = o.target;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
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
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return null;
    return {
      text,
      rectW: rect.width,
      rectH: rect.height,
      baseline,
      fontCss,
      letterSpacing: cs.letterSpacing === 'normal' ? '' : cs.letterSpacing,
      fontSizePx,
    };
  };

  const inner = mountAlphaGlass<TextMeasured>({
    target: o.target,
    host: o.host,
    idPrefix: 'gtext-' + Math.random().toString(36).slice(2, 8),
    params,
    glint: o.glint,
    dpr,
    ready: () => document.fonts.ready, // canvas needs the final glyph metrics
    onReady: o.onReady,
    measure,
    buildMap: (mm, cur, cache) =>
      buildGlyphDisplacementMap(
        {
          ...mm,
          dpr,
          bevel: cur.bevel,
          dome: cur.dome,
          edge: cur.edge,
          glow: cur.glow,
          shade: cur.shade,
        },
        cache,
      ),
  });

  // Wrap so the instance is registered with the shared Tuner surface.
  const handle: GlassText = {
    reconfigure: (patch) => inner.reconfigure(patch),
    getOptions: () => inner.getOptions(),
    dispose: () => {
      inner.dispose();
      instances.delete(handle);
    },
  };
  instances.add(handle);
  return handle;
}
