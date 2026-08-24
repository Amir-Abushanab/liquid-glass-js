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
  strength: 0.5,
  chroma: 1,
  blur: 1.2,
  bevel: 1.3,
  dome: 12,
  edge: 1.5,
  glow: 1,
  shade: 1,
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
  padLeft: number;
  fontCss: string;
  letterSpacing: string;
  fontSizePx: number;
}

/**
 * How much bigger or smaller the browser actually drew this text than its computed
 * `font-size` says — as a multiplier for the canvas font.
 *
 * A canvas 2D context understands `font-style font-weight font-size font-family` and
 * nothing else. CSS has properties that change the USED glyph size without changing
 * the reported `font-size`, and `font-size-adjust` is the common one: `from-font` on a
 * root element (a very ordinary thing to set) normalises x-height across fallback
 * faces, so switching family silently rescales every glyph. Measured on one 64px
 * element under `font-size-adjust: from-font`, DOM run width vs canvas run width for
 * the same font shorthand:
 *
 *   mono     370.1 vs 384.0   canvas 3.6% too wide
 *   serif    374.5 vs 351.1   canvas 6.6% too narrow
 *   script   406.1 vs 282.0   canvas 44% too narrow
 *
 * The error is per-glyph and therefore cumulative, so the map drifts further from the
 * text the further along the line you look — the glass slides off the end of the word.
 * The same trap catches synthesised weights and anything else that alters the used
 * size, so this measures the outcome rather than trying to reimplement the causes:
 * clone the element (so it keeps every inherited property), strip letter-spacing (an
 * absolute length, which must not be scaled), and compare its laid-out width to what
 * the canvas makes of the same font.
 */
function fontScale(el: HTMLElement, cs: CSSStyleDeclaration, sizePx: number): number {
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  if (!text) return 1;
  let domW = 0;
  try {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.removeAttribute('id');
    // Padding and border have to go, along with letter-spacing: this is comparing the
    // width of the GLYPHS against what the canvas makes of them, and a box that carries
    // any of those measures wider than its text. Padding on the target is not
    // hypothetical — it is how you stop `background-clip: text` cutting descenders off
    // — and left in, it inflates the ratio and rasterizes the map oversized, which
    // reads as the glass sliding off the letters.
    clone.style.cssText = `${el.getAttribute('style') || ''};position:absolute;left:-99999px;top:0;visibility:hidden;white-space:pre;letter-spacing:0;padding:0;border:0;width:auto;max-width:none`;
    (el.parentNode ?? document.body).appendChild(clone);
    domW = clone.getBoundingClientRect().width;
    clone.remove();
  } catch {
    return 1;
  }
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx || !(domW > 0)) return 1;
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in (ctx as object)) c.letterSpacing = '0px';
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${sizePx}px ${cs.fontFamily}`;
  const canW = ctx.measureText(text).width;
  if (!(canW > 0)) return 1;
  const k = domW / canW;
  // A wild ratio means the clone did not lay out the way the original did (display
  // rules keyed on position, a container query, an ancestor that had to be there).
  // Rather than rasterize at some absurd size, fall back to trusting the CSS value.
  return k > 0.25 && k < 4 ? k : 1;
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
  //
  const measure = (): TextMeasured | null => {
    const el = o.target;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const cs = getComputedStyle(el);
    const specifiedPx = parseFloat(cs.fontSize) || 16;
    const letterSpacing = cs.letterSpacing === 'normal' ? '' : cs.letterSpacing;
    // Compose from longhands — the computed `font` shorthand is empty in Firefox.
    // The size in it is the one CANVAS should use, which is not always the one CSS
    // reports: see fontScale below.
    const fontSizePx = specifiedPx * fontScale(el, cs, specifiedPx);
    const fontCss = `${cs.fontStyle} ${cs.fontWeight} ${fontSizePx}px ${cs.fontFamily}`;
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
      padLeft: parseFloat(cs.paddingLeft) || 0,
      fontCss,
      letterSpacing,
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
          padLeft: mm.padLeft,
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
