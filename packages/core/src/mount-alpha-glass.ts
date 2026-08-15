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
import {
  applyGlassFilter,
  clearGlassFilter,
  primitiveScale,
  glassOriginOffset,
} from './filter-origin';

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
    const k = primitiveScale(core.target); // see regen(): 1 except viewBox'd svg on WebKit
    const s = scales();
    dispNodes.forEach((d, i) => d.setAttribute('scale', String(s[i] * k)));
    blurNode?.setAttribute('stdDeviation', String(cur.blur * k));
  };

  const regen = () => {
    if (disposed || !m) return;
    const map = core.buildMap(m, cur, cache);
    if (!map.url) return;
    const id = `${core.idPrefix}-${++n}`; // fresh id on every map change (Safari cache bust)
    // Every primitiveUnits value below goes through k. It is 1 everywhere except an
    // inline <svg> target with a non-css-px viewBox on WebKit — see primitiveScale.
    const k = primitiveScale(core.target);
    // ...and every userSpaceOnUse POSITION also takes the origin offset. It is 0,0
    // unless WebKit needs this element's origin corrected and the transform pin is
    // unavailable — which is the case for a target carrying a fixed-attachment
    // background, as the glass wordmark does. Without it the region and the map land
    // at the document origin, the map is empty here, and the closing
    // `operator="in"` against SourceAlpha clips the result to nothing: blank text.
    const org = glassOriginOffset(core.target);
    const ox = (-map.margin + org.x) * k;
    const oy = (-map.margin + org.y) * k;
    const [s1, s2, s3] = scales().map((v) => v * k);
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    // The feImage carries an EXPLICIT subregion, and it has to. Left without one it
    // fills the filter region instead, which makes the map's scale and position
    // hostage to whatever region the engine computed — and WebKit intersects the
    // region with the element's own box when the target is an inline <svg>, as
    // glass marks are. Measured on a 180x180 <svg>, region declared -20,-20 220x220:
    //
    //   chromium -> map painted 220x220 at the declared origin   (correct)
    //   webkit   -> map painted 180x180 at the element origin    (clipped to the box)
    //
    // so the map got squeezed into the smaller box and shifted by the margin: the
    // displacement field stopped lining up with the artwork, which is the glass mark
    // losing its rim and showing a dark offset crescent. With a subregion the map is
    // placed on its own terms and the region only clips — and the chain already ends
    // in `operator="in"` against SourceAlpha, so clipping changes nothing visible.
    //
    // The REGION takes k as well as the primitives. WebKit reads every filter
    // coordinate on an inline <svg> in the svg's own user units, the region
    // included. That is easy to miss when the viewBox is coarser than css px: the
    // region merely grows and is clipped back to the element, which looks correct.
    // It only shows when the viewBox is FINER (128 units drawn at 90px, k>1), where
    // the region shrinks to 90*0.703 = 63px and shears the right and bottom off any
    // artwork that reaches its edges — the framework logos, while the droplet and
    // sparkle float clear of theirs and looked fine.
    //
    // Both are also userSpaceOnUse, which Safari resolves against the page origin
    // unless the target owns a coordinate system (see filter-origin.ts) — that is
    // why glass text and glass marks rendered as blank space there. applyGlassFilter
    // below pins it. Inline <svg> targets already own one, so they were never
    // affected by that half.
    //
    // The region must NOT be expressed as objectBoundingBox percentages instead:
    // that box is the ink bbox, not the border box, and the engines disagree about
    // it — for one 270x84 text element, webkit/firefox resolve 272x100 and chromium
    // 270x99 — so a px-exact map extent cannot be written as a percentage.
    div.innerHTML =
      `<svg width="0" height="0" aria-hidden="true"><filter id="${id}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x="${ox}" y="${oy}" width="${map.cssW * k}" height="${map.cssH * k}" color-interpolation-filters="sRGB">` +
      `<feFlood flood-color="rgb(128,128,128)" flood-opacity="1" result="mapBg"></feFlood>` +
      `<feImage href="${map.url}" xlink:href="${map.url}" x="${ox}" y="${oy}" width="${map.cssW * k}" height="${map.cssH * k}" preserveAspectRatio="none" result="rawMap"></feImage>` +
      `<feComposite in="rawMap" in2="mapBg" operator="over" result="map"></feComposite>` +
      `<feGaussianBlur in="SourceGraphic" stdDeviation="${cur.blur * k}" result="blurred"></feGaussianBlur>` +
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
    applyGlassFilter(core.target, id);
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
      clearGlassFilter(core.target);
    },
  };
}
