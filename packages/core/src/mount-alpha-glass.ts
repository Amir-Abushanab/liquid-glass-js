// Shared mount machinery for alpha-shaped liquid glass (text, SVG marks,
// images, canvases). glass-text and glass-shape are both "a displacement map
// shaped like some alpha coverage, fed through the clip-to-SourceAlpha filter
// chain, regenerated on resize" — only the measuring and the rasterization
// differ. This owns the ~identical rest: the filter chain, fresh-id-per-map
// (Safari), attribute-only fast path, rAF+timeout-coalesced regen, and the
// ResizeObserver. glass-text was rebased onto it with byte-identical output.

import { type GlyphMap, type GlyphMapCache } from './glyph-map';
import { specMaskValues, darkMaskValues } from './map-encode';
import { parseCssColor } from './color';

// The seven refraction params + shade (item 2). Same set for text and shapes.
export interface AlphaGlassParams {
  strength: number; // refraction reach, px (attribute-only update)
  chroma: number; // per-channel split (attribute-only)
  blur: number; // fill pre-blur, px (attribute-only)
  bevel: number; // rim width — map param
  dome: number; // interior swell — map param
  edge: number; // rim glint — map param
  glow: number; // soft sheen — map param
  shade: number; // dark occlusion rim — map param
}

// Every measured shape carries at least its content box; text adds more.
export interface AlphaGlassMeasured {
  rectW: number;
  rectH: number;
}

export interface AlphaGlassCore<M extends AlphaGlassMeasured> {
  target: HTMLElement; // element that receives filter:url()
  host: HTMLElement; // where the <svg><filter> holder is appended
  idPrefix: string; // filter id namespace (e.g. 'gtext', 'gshape')
  params: AlphaGlassParams; // starting params (copied)
  glint?: string; // CSS colour for the glint (default white)
  dpr: number;
  ready?: () => Promise<unknown>; // awaited before the first measure (fonts / image decode)
  measure: () => M | null; // remeasure the target; null = nothing to render
  buildMap: (measured: M, cur: AlphaGlassParams, cache: GlyphMapCache) => GlyphMap;
  onReady?: () => void; // fired once, after the FIRST regen applies the filter (item 5)
}

export interface AlphaGlass {
  reconfigure(patch: Partial<AlphaGlassParams>): void;
  getOptions(): AlphaGlassParams;
  dispose(): void;
}

// Which params require a map regen (vs a cheap filter-attribute update).
const MAP_KEYS = ['bevel', 'dome', 'edge', 'glow', 'shade'] as const;

export function mountAlphaGlass<M extends AlphaGlassMeasured>(core: AlphaGlassCore<M>): AlphaGlass {
  const cur: AlphaGlassParams = { ...core.params };
  const glintRgb = parseCssColor(core.glint ?? '#ffffff');
  const cache: GlyphMapCache = {};
  let n = 0;
  let raf = 0;
  let tid = 0;
  let disposed = false;
  let holder: HTMLElement | null = null;
  let dispNodes: SVGFEDisplacementMapElement[] = [];
  let blurNode: SVGFEGaussianBlurElement | null = null;
  let ro: ResizeObserver | null = null;
  let m: M | null = null;
  let firstRegen = true;

  const scales = () => [
    cur.strength * (1 + 0.2 * cur.chroma),
    cur.strength * (1 + 0.1 * cur.chroma),
    cur.strength,
  ];

  const applyAttrs = () => {
    if (!dispNodes.length) return;
    const s = scales();
    dispNodes.forEach((d, i) => d.setAttribute('scale', String(s[i])));
    blurNode?.setAttribute('stdDeviation', String(cur.blur));
  };

  const regen = () => {
    if (disposed || !m) return;
    const map = core.buildMap(m, cur, cache);
    if (!map.url) return;
    const id = `${core.idPrefix}-${++n}`; // fresh id on every map change (Safari cache bust)
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
      `<feColorMatrix in="map" type="matrix" values="${specMaskValues(glintRgb)}" result="specMask"></feColorMatrix>` +
      `<feComposite in="specMask" in2="refr" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lit"></feComposite>` +
      // dark occlusion rim (item 2): multiplicative darkening on the map's r < 0 pixels
      `<feColorMatrix in="map" type="matrix" values="${darkMaskValues()}" result="darkMask"></feColorMatrix>` +
      `<feComposite in="darkMask" in2="lit" operator="arithmetic" k1="-1" k2="0" k3="1" k4="0" result="litDark"></feComposite>` +
      // Clip AFTER the specular add: the outer half of the rim glint is discarded
      // on purpose — inward-biased bevel light, crisp silhouette, no halo bleed.
      `<feComposite in="litDark" in2="SourceAlpha" operator="in"></feComposite>` +
      `</filter></svg>`;
    core.host.appendChild(div);
    core.target.style.filter = `url(#${id})`;
    core.target.style.setProperty('-webkit-filter', `url(#${id})`);
    if (holder) holder.remove();
    holder = div;
    dispNodes = Array.from(div.querySelectorAll('feDisplacementMap'));
    blurNode = div.querySelector('feGaussianBlur');
    if (firstRegen) {
      firstRegen = false;
      core.onReady?.(); // the filter has landed — let the consumer un-dim (item 5)
    }
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
    // rAF freezes entirely on hidden tabs — the timeout keeps a deferred regen
    // from parking there unapplied (throttled to ~1s when hidden).
    tid = window.setTimeout(() => {
      if (raf) {
        cancelAnimationFrame(raf);
        flush();
      }
    }, 150);
  };

  const init = async () => {
    if (core.ready) {
      try {
        await core.ready();
      } catch {
        /* older engines / undecodable source: measure with whatever loaded */
      }
    }
    if (disposed) return;
    m = core.measure();
    regen();
    ro = new ResizeObserver(() => {
      if (disposed) return;
      const r = core.target.getBoundingClientRect();
      if (m && Math.abs(r.width - m.rectW) < 0.5 && Math.abs(r.height - m.rectH) < 0.5) return;
      m = core.measure();
      scheduleRegen();
    });
    ro.observe(core.target);
  };
  void init();

  return {
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
      core.target.style.filter = '';
      core.target.style.removeProperty('-webkit-filter');
    },
  };
}
