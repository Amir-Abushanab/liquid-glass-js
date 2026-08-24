// Moving glass lens over live DOM — Aave's actual "AaveGlass" delivery.
//
// A lens-sized displacement map (the dome/SDF generator) is dropped into an SVG
// feDisplacementMap filter via a positioned <feImage>, and that filter is applied
// to a live-DOM refractionTarget. Only the lens region bends; the rest of the map
// is neutral, so the content passes through untouched — and stays selectable,
// scrollable and clickable (it's real DOM, not a canvas). Works in every browser.
//
//   • setPos(x, y) just moves the <feImage> — the map stays put, so dragging is
//     cheap (the article: "only the filter's region shifts... the map stays the same").
//   • setSize() regenerates the map AND gives the filter a fresh id — Safari caches
//     filter output by id and would otherwise serve the stale map.
//
// Everything here positions in userSpaceOnUse, which Safari resolves against the
// page origin unless the filtered element owns a coordinate system — see
// filter-origin.ts. applyGlassFilter pins it; without that the lens refracts
// wherever the target happens to sit in the document instead of under the pointer.

import { buildDisplacementMap } from './displacement';
import { specMaskValues, darkMaskValues } from './map-encode';
import { parseCssColor } from './color';
import { applyGlassFilter, clearGlassFilter, refreshGlassFilter } from './filter-origin';
import { preBlurStd } from './blur-quantize';

export interface GlassLensOptions {
  target: HTMLElement; // live DOM to refract (receives filter:url())
  host: HTMLElement; // where the <svg> filter node is appended
  lensW: number;
  lensH: number;
  radius?: number;
  depth?: number;
  dome?: number;
  edge?: number;
  glow?: number;
  strength?: number;
  chroma?: number;
  blur?: number;
  shade?: number; // dark occlusion rim opposite the glint (0–1, default 0)
  glint?: string; // CSS colour for the specular glint (default white)
  active?: boolean; // start with the filter applied? (default true; false = solid until setActive)
}

// The live-tunable refraction params (everything except target/host/lens size).
export interface GlassLensParams {
  radius: number;
  depth: number;
  dome: number;
  edge: number;
  glow: number;
  strength: number;
  chroma: number;
  blur: number;
  shade: number;
}

export interface GlassLens {
  setPos(x: number, y: number): void;
  setSize(w: number, h: number): void;
  reconfigure(patch: Partial<GlassLensParams>): void;
  getOptions(): GlassLensParams;
  setActive(on: boolean): void; // toggle the refraction filter on/off (glass-while-interacting)
  dispose(): void;
}

export function mountGlassLens(o: GlassLensOptions): GlassLens {
  const base = 'glens-' + Math.random().toString(36).slice(2, 8);
  // Live-tunable params — the Glass Tuner mutates these via reconfigure().
  const cur: GlassLensParams = {
    radius: o.radius ?? Math.min(o.lensW, o.lensH) / 2,
    depth: o.depth ?? 6,
    dome: o.dome ?? 8,
    edge: o.edge ?? 0.8,
    glow: o.glow ?? 0.3,
    strength: o.strength ?? 16,
    chroma: o.chroma ?? 0.5,
    blur: o.blur ?? 0.5,
    shade: o.shade ?? 0,
  };
  const glintRgb = parseCssColor(o.glint ?? '#ffffff'); // mount-only; white = no tint

  // Snap to integer px: a fractional lens (e.g. 645.125 from a %-width bar) makes the
  // <feImage> display the integer-truncated map canvas at a ~1.0002 scale, and that
  // near-unity resample beats into a moiré — faint scanlines on a wide lens. Integer
  // dims keep the map 1:1 with its display box, so there's nothing to beat.
  let lensW = Math.round(o.lensW);
  let lensH = Math.round(o.lensH);
  let lx = 0;
  let ly = 0;
  let n = 0;
  let active = o.active ?? true;
  let curId = '';
  let holder: HTMLElement | null = null;
  let feImage: SVGFEImageElement | null = null;
  let specNode: SVGFEColorMatrixElement | null = null;
  let filterNode: SVGFilterElement | null = null;
  let dispNodes: SVGFEDisplacementMapElement[] = [];
  let blurNode: SVGFEGaussianBlurElement | null = null;

  const rebuild = () => {
    const id = `${base}-${++n}`; // fresh id on every map change (Safari cache bust)
    const s1 = cur.strength * (1 + 0.2 * cur.chroma);
    const s2 = cur.strength * (1 + 0.1 * cur.chroma);
    const s3 = cur.strength;
    // Supersample: render the dome field at s× device resolution and let the
    // <feImage> (kept at CSS px below) scale it down, so the rim doesn't alias on
    // retina (item 4). The field is scale-invariant, so every length scales by s.
    const s = Math.min(window.devicePixelRatio || 1, 2);
    const map = buildDisplacementMap({
      width: lensW * s,
      height: lensH * s,
      radius: cur.radius * s,
      depth: cur.depth * s,
      dome: cur.dome * s,
      edge: cur.edge,
      glow: cur.glow,
      shade: cur.shade,
      pxScale: s,
    });
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    div.innerHTML =
      `<svg width="0" height="0" aria-hidden="true"><filter id="${id}" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
      `<feFlood flood-color="rgb(128,128,128)" flood-opacity="1" result="mapBg"></feFlood>` +
      `<feImage href="${map}" xlink:href="${map}" x="${lx}" y="${ly}" width="${lensW}" height="${lensH}" preserveAspectRatio="none" result="rawMap"></feImage>` +
      `<feComposite in="rawMap" in2="mapBg" operator="over" result="map"></feComposite>` +
      // A sub-threshold pre-blur is zeroed: it is invisible in engines that blur
      // correctly and costs Safari a quarter of the source's colour. See preBlurStd.
      `<feGaussianBlur in="SourceGraphic" stdDeviation="${preBlurStd(cur.blur)}" result="blurred"></feGaussianBlur>` +
      `<feDisplacementMap in="blurred" in2="map" scale="${s1}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
      `<feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispR"></feColorMatrix>` +
      `<feDisplacementMap in="blurred" in2="map" scale="${s2}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispG"></feColorMatrix>` +
      `<feDisplacementMap in="blurred" in2="map" scale="${s3}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="dispB"></feColorMatrix>` +
      `<feComposite in="dispR" in2="dispG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"></feComposite>` +
      `<feComposite in2="dispB" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lensResult"></feComposite>` +
      `<feColorMatrix in="map" x="${lx - 1}" y="${ly - 1}" width="${lensW + 2}" height="${lensH + 2}" type="matrix" values="${specMaskValues(glintRgb)}" result="specMask"></feColorMatrix>` +
      `<feComposite in="specMask" in2="lensResult" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lit"></feComposite>` +
      // dark occlusion rim (item 2): multiplicative darkening on the map's r < 0 pixels
      `<feColorMatrix in="map" x="${lx - 1}" y="${ly - 1}" width="${lensW + 2}" height="${lensH + 2}" type="matrix" values="${darkMaskValues()}" result="darkMask"></feColorMatrix>` +
      `<feComposite in="darkMask" in2="lit" operator="arithmetic" k1="-1" k2="0" k3="1" k4="0"></feComposite>` +
      `</filter></svg>`;
    o.host.appendChild(div);
    curId = id;
    if (active) applyGlassFilter(o.target, id);
    else clearGlassFilter(o.target);
    if (holder) holder.remove();
    holder = div;
    feImage = div.querySelector('feImage');
    specNode = div.querySelector<SVGFEColorMatrixElement>('[result="specMask"]');
    filterNode = div.querySelector('filter');
    dispNodes = Array.from(div.querySelectorAll('feDisplacementMap'));
    blurNode = div.querySelector('feGaussianBlur');
  };

  // Which params the MAP is built from. Everything else — strength, chroma, blur —
  // only ever lands on a filter attribute, so it can be driven per frame without
  // re-encoding a PNG. Same split mountGlassText has had all along, which is why
  // animating `strength` there is smooth and doing it here used to rebuild the map
  // sixty times a second.
  const MAP_KEYS = ['radius', 'depth', 'dome', 'edge', 'glow', 'shade'] as const;

  const applyAttrs = () => {
    const s = cur.strength;
    dispNodes[0]?.setAttribute('scale', String(s * (1 + 0.2 * cur.chroma)));
    dispNodes[1]?.setAttribute('scale', String(s * (1 + 0.1 * cur.chroma)));
    dispNodes[2]?.setAttribute('scale', String(s));
    blurNode?.setAttribute('stdDeviation', String(preBlurStd(cur.blur)));
    // Safari paints the output it cached when the id was minted, so the writes above
    // are invisible there until the filter is re-pointed. See refreshGlassFilter.
    if (active && filterNode) curId = refreshGlassFilter(o.target, filterNode, `${base}-${++n}`);
  };

  rebuild();

  return {
    setPos(x, y) {
      x = Math.round(x); // integer px — same anti-moiré reason as the size snap above
      y = Math.round(y);
      // A drift that moves less than a pixel per frame rounds to the same spot for
      // several frames running. Bail before touching anything: the attribute writes
      // would be no-ops, but the Safari rename below is not — re-pointing the filter
      // costs a re-rasterization, and doing it on frames that cannot have changed is
      // pure artefact for nothing.
      if (x === lx && y === ly) return;
      lx = x;
      ly = y;
      // just reposition the map — no regenerate (cheap, holds frame rate on drag)
      feImage?.setAttribute('x', String(x));
      feImage?.setAttribute('y', String(y));
      // keep the specular's lens-sized subregion tracking the lens — Aave's
      // "spending less on Safari's highlight": evaluate the spec pass over just
      // the lens box instead of the whole filter region.
      specNode?.setAttribute('x', String(x - 1));
      specNode?.setAttribute('y', String(y - 1));
      // Safari caches filter output by id, so those attribute writes alone leave it
      // painting the cached lens at the position the id was minted at — the stuck
      // layer the moving lens appears to leave behind. Rename to force a re-run; the
      // map is untouched, so this costs no map rebuild.
      if (active && filterNode) curId = refreshGlassFilter(o.target, filterNode, `${base}-${++n}`);
    },
    setSize(w, h) {
      w = Math.round(w);
      h = Math.round(h);
      if (w === lensW && h === lensH) return;
      lensW = w;
      lensH = h;
      rebuild();
    },
    reconfigure(patch) {
      Object.assign(cur, patch);
      if (MAP_KEYS.some((k) => patch[k] != null)) rebuild();
      else applyAttrs();
    },
    getOptions() {
      return { ...cur };
    },
    setActive(on) {
      active = on;
      if (on) applyGlassFilter(o.target, curId);
      else clearGlassFilter(o.target);
    },
    dispose() {
      holder?.remove();
      clearGlassFilter(o.target);
    },
  };
}
