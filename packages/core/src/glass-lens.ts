// Moving glass lens over live DOM — Aave's actual "AaveGlass" delivery.
//
// A displacement map is dropped into an SVG feDisplacementMap filter and applied
// to a live-DOM refractionTarget. Only the lens region bends; the rest of the map
// is neutral, so the content passes through untouched — and stays selectable,
// scrollable and clickable (it's real DOM, not a canvas).
//
// HOW THE MAP IS POSITIONED, AND WHY IT LOOKS ROUNDABOUT
//
// The obvious encoding is a lens-sized <feImage> carrying a primitive subregion
// (x/y/width/height) that puts it where the lens is. Do not do that: WebKit
// resolves `primitiveUnits="userSpaceOnUse"` subregions against the PAGE origin
// instead of the filtered element's own origin, so the map lands offset by the
// element's position in the document — measured, 3 engines:
//
//   element at page (50,50), feImage subregion x=60 y=60
//     webkit   -> map at page  60,60   (element origin ignored)
//     firefox  -> map at page 110,110  (correct)
//     chromium -> map at page 110,110  (correct)
//
// Further down the page = further off, which is why glass further down Safari
// broke harder, and why the lens appeared to "split" — the ring follows the
// pointer, the refraction happens somewhere else entirely.
//
// So: no primitive carries a subregion. An <feImage> without one stretches its
// image to fill the whole filter region (exactly, and identically in all three
// engines), which means the map canvas has to BE the filter region — the dome is
// drawn into a region-sized neutral canvas rather than positioned by the filter.
//
//   • setPos(x, y) moves the map with feOffset — a relative shift, so no origin
//     is involved and no engine can disagree about it. Still cheap: the map
//     itself is untouched, only the offset attribute changes.
//   • setSize() regenerates the map AND gives the filter a fresh id — Safari
//     caches filter output by id and would otherwise serve the stale map.

import { renderDisplacementMap } from './displacement';
import { specMaskValues, darkMaskValues, NEUTRAL_BYTE } from './map-encode';
import { parseCssColor } from './color';

// The default filter region: x/y = -10%, width/height = 120% of the border box.
// We inherit it rather than declaring filterUnits ourselves — one less coordinate
// system to be wrong about, and it is provably consistent across engines.
const REGION_PAD = 0.1;
const REGION_SCALE = 1.2;

// The map is now region-sized rather than lens-sized, so a large target could ask
// for a very large canvas. Cap the pixel count and trade supersampling away first;
// the field is smooth, so a downscaled map degrades gracefully.
const MAX_MAP_PX = 4e6;

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
  // dome land on a half-pixel inside the map canvas, and that near-unity resample
  // beats into a moiré — faint scanlines on a wide lens.
  let lensW = Math.round(o.lensW);
  let lensH = Math.round(o.lensH);
  let lx = 0;
  let ly = 0;
  let n = 0;
  let active = o.active ?? true;
  let curId = '';
  let holder: HTMLElement | null = null;
  let offsetNode: SVGFEOffsetElement | null = null;
  // Region geometry, refreshed on every rebuild — setPos needs the pad to convert
  // an element-local lens position into an offset from the region's origin.
  let padX = 0;
  let padY = 0;
  let tgtW = 0;
  let tgtH = 0;

  // The filter region resolves against the element's LAYOUT border box, which is
  // what offsetWidth/Height report. getBoundingClientRect would fold in an ancestor
  // scale — the loupe mounts a lens on a clone inside a scaling popover — and size
  // the map in painted px instead of user units.
  const targetBox = (): [number, number] => {
    const r = o.target.getBoundingClientRect();
    return [
      Math.max(1, o.target.offsetWidth || r.width),
      Math.max(1, o.target.offsetHeight || r.height),
    ];
  };

  const applyPos = () => {
    // Round the composed offset, not its parts: keeps the map pixel-aligned to the
    // region so the rim stays crisp.
    offsetNode?.setAttribute('dx', String(Math.round(lx + padX)));
    offsetNode?.setAttribute('dy', String(Math.round(ly + padY)));
  };

  const rebuild = () => {
    const id = `${base}-${++n}`; // fresh id on every map change (Safari cache bust)
    const s1 = cur.strength * (1 + 0.2 * cur.chroma);
    const s2 = cur.strength * (1 + 0.1 * cur.chroma);
    const s3 = cur.strength;

    [tgtW, tgtH] = targetBox();
    padX = tgtW * REGION_PAD;
    padY = tgtH * REGION_PAD;
    const regW = tgtW * REGION_SCALE;
    const regH = tgtH * REGION_SCALE;

    // Supersample: render the field at s× device resolution and let the <feImage>
    // scale it down to the region, so the rim doesn't alias on retina. The field is
    // scale-invariant, so every length scales by s.
    let s = Math.min(window.devicePixelRatio || 1, 2);
    s = Math.max(0.5, Math.min(s, Math.sqrt(MAX_MAP_PX / (regW * regH))));

    const dome = renderDisplacementMap({
      width: Math.round(lensW * s),
      height: Math.round(lensH * s),
      radius: cur.radius * s,
      depth: cur.depth * s,
      dome: cur.dome * s,
      edge: cur.edge,
      glow: cur.glow,
      shade: cur.shade,
      pxScale: s,
    });
    // The map spans the filter region; the dome sits at its origin and feOffset
    // slides it into place. Everywhere else is neutral, so nothing bends there.
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(regW * s));
    cv.height = Math.max(1, Math.round(regH * s));
    const cx = cv.getContext('2d');
    if (cx) {
      cx.fillStyle = `rgb(${NEUTRAL_BYTE},${NEUTRAL_BYTE},${NEUTRAL_BYTE})`;
      cx.fillRect(0, 0, cv.width, cv.height);
      cx.drawImage(dome, 0, 0);
    }
    const map = cv.toDataURL();

    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    div.innerHTML =
      `<svg width="0" height="0" aria-hidden="true"><filter id="${id}" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
      // feOffset vacates a strip at the region's top-left; the flood backfills it
      // with neutral so the map is defined everywhere.
      `<feFlood flood-color="rgb(${NEUTRAL_BYTE},${NEUTRAL_BYTE},${NEUTRAL_BYTE})" flood-opacity="1" result="mapBg"></feFlood>` +
      `<feImage href="${map}" xlink:href="${map}" preserveAspectRatio="none" result="rawMap"></feImage>` +
      `<feOffset in="rawMap" dx="0" dy="0" result="movedMap"></feOffset>` +
      `<feComposite in="movedMap" in2="mapBg" operator="over" result="map"></feComposite>` +
      `<feGaussianBlur in="SourceGraphic" stdDeviation="${cur.blur}" result="blurred"></feGaussianBlur>` +
      `<feDisplacementMap in="blurred" in2="map" scale="${s1}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
      `<feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispR"></feColorMatrix>` +
      `<feDisplacementMap in="blurred" in2="map" scale="${s2}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispG"></feColorMatrix>` +
      `<feDisplacementMap in="blurred" in2="map" scale="${s3}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="dispB"></feColorMatrix>` +
      `<feComposite in="dispR" in2="dispG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"></feComposite>` +
      `<feComposite in2="dispB" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lensResult"></feComposite>` +
      // The spec/dark masks run over the whole region instead of a lens-sized
      // subregion. That is free: both matrices pull alpha from the map's B channel
      // as ±(B − 128/255), which is exactly 0 on every neutral pixel, so outside
      // the dome they are transparent and contribute nothing to either composite.
      `<feColorMatrix in="map" type="matrix" values="${specMaskValues(glintRgb)}" result="specMask"></feColorMatrix>` +
      `<feComposite in="specMask" in2="lensResult" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lit"></feComposite>` +
      // dark occlusion rim (item 2): multiplicative darkening on the map's r < 0 pixels
      `<feColorMatrix in="map" type="matrix" values="${darkMaskValues()}" result="darkMask"></feColorMatrix>` +
      `<feComposite in="darkMask" in2="lit" operator="arithmetic" k1="-1" k2="0" k3="1" k4="0"></feComposite>` +
      `</filter></svg>`;
    o.host.appendChild(div);
    curId = id;
    if (active) {
      o.target.style.filter = `url(#${id})`;
      o.target.style.setProperty('-webkit-filter', `url(#${id})`);
    } else {
      o.target.style.filter = '';
      o.target.style.removeProperty('-webkit-filter');
    }
    if (holder) holder.remove();
    holder = div;
    offsetNode = div.querySelector('feOffset');
    applyPos();
  };

  rebuild();

  // The map is sized to the target, so a resized target needs a fresh one.
  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => {
      const [w, h] = targetBox();
      if (Math.abs(w - tgtW) < 0.5 && Math.abs(h - tgtH) < 0.5) return;
      rebuild();
    });
    ro.observe(o.target);
  }

  return {
    setPos(x, y) {
      lx = Math.round(x); // integer px — same anti-moiré reason as the size snap above
      ly = Math.round(y);
      applyPos(); // just slide the map — no regenerate (cheap, holds frame rate on drag)
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
      rebuild();
    },
    getOptions() {
      return { ...cur };
    },
    setActive(on) {
      active = on;
      if (on) {
        o.target.style.filter = `url(#${curId})`;
        o.target.style.setProperty('-webkit-filter', `url(#${curId})`);
      } else {
        o.target.style.filter = '';
        o.target.style.removeProperty('-webkit-filter');
      }
    },
    dispose() {
      ro?.disconnect();
      holder?.remove();
      o.target.style.filter = '';
      o.target.style.removeProperty('-webkit-filter');
    },
  };
}
