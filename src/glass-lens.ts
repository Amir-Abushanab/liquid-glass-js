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

import { buildDisplacementMap } from './displacement';

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
  };

  let lensW = o.lensW;
  let lensH = o.lensH;
  let lx = 0;
  let ly = 0;
  let n = 0;
  let active = o.active ?? true;
  let curId = '';
  let holder: HTMLElement | null = null;
  let feImage: SVGFEImageElement | null = null;
  let specNode: SVGFEColorMatrixElement | null = null;

  const rebuild = () => {
    const id = `${base}-${++n}`; // fresh id on every map change (Safari cache bust)
    const s1 = cur.strength * (1 + 0.2 * cur.chroma);
    const s2 = cur.strength * (1 + 0.1 * cur.chroma);
    const s3 = cur.strength;
    const map = buildDisplacementMap({
      width: lensW,
      height: lensH,
      radius: cur.radius,
      depth: cur.depth,
      dome: cur.dome,
      edge: cur.edge,
      glow: cur.glow,
    });
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    div.innerHTML =
      `<svg width="0" height="0" aria-hidden="true"><filter id="${id}" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
      `<feFlood flood-color="rgb(128,128,128)" flood-opacity="1" result="mapBg"></feFlood>` +
      `<feImage href="${map}" xlink:href="${map}" x="${lx}" y="${ly}" width="${lensW}" height="${lensH}" preserveAspectRatio="none" result="rawMap"></feImage>` +
      `<feComposite in="rawMap" in2="mapBg" operator="over" result="map"></feComposite>` +
      `<feGaussianBlur in="SourceGraphic" stdDeviation="${cur.blur}" result="blurred"></feGaussianBlur>` +
      `<feDisplacementMap in="blurred" in2="map" scale="${s1}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
      `<feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispR"></feColorMatrix>` +
      `<feDisplacementMap in="blurred" in2="map" scale="${s2}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispG"></feColorMatrix>` +
      `<feDisplacementMap in="blurred" in2="map" scale="${s3}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="dispB"></feColorMatrix>` +
      `<feComposite in="dispR" in2="dispG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"></feComposite>` +
      `<feComposite in2="dispB" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lensResult"></feComposite>` +
      `<feColorMatrix in="map" x="${lx - 1}" y="${ly - 1}" width="${lensW + 2}" height="${lensH + 2}" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 1 0 -0.5019607843137255" result="specMask"></feColorMatrix>` +
      `<feComposite in="specMask" in2="lensResult" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"></feComposite>` +
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
    feImage = div.querySelector('feImage');
    specNode = div.querySelector<SVGFEColorMatrixElement>('[result="specMask"]');
  };

  rebuild();

  return {
    setPos(x, y) {
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
    },
    setSize(w, h) {
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
      holder?.remove();
      o.target.style.filter = '';
      o.target.style.removeProperty('-webkit-filter');
    },
  };
}
