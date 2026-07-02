// SVG ripple bloom — the ripple button's refraction bloom done with the SVG
// feDisplacementMap path instead of a WebGL shader (this is now the button's
// only renderer). A press spawns an expanding refraction lens at that point; the
// same filter that powers mountGlassLens is animated — but instead of
// regenerating the map each frame (slow + fights Safari's filter cache), we
// generate ONE fixed dome map and stretch it via the <feImage> geometry, fading
// the displacement scale as the wave expands. So per frame we only touch
// attributes: feImage x/y/width/height + the 3 chroma feDisplacementMap scales.
//
// The lens grows as an ELLIPSE matched to the button's aspect (like the shader's
// UV-space circle, which stretches to the button), with chroma split + a
// palette-tinted specular glint and a hair of blur for glassiness. The one thing
// it can't cheaply do that the shader could: accumulate 5 overlapping blooms —
// SVG can't sum displacement maps, so it's ONE bloom at a time (re-press restarts).
//
// It refracts the target's OWN content (a grid/gradient pane inside the button).
// Bending the real page behind it would need backdrop-filter:url() (Chromium-only).

import { buildDisplacementMap } from './displacement';
import { SPLASH_COLORS, hexToRgb } from './qr/painting';

// Live-tunable ripple params (the Glass Tuner mutates these via reconfigure()).
export interface SvgRippleParams {
  maxFrac: number; // final bloom half-size as a fraction of the button size (per axis → elliptical)
  duration: number; // ms
  strength: number; // peak displacement, px (fades to 0 as the wave grows)
  chroma: number; // per-channel split amount
  spec: number; // specular-glint strength
  blur: number; // source softening, px (glassiness)
}

export interface SvgRippleOptions extends Partial<SvgRippleParams> {
  target: HTMLElement; // inner content layer to refract (receives filter:url())
  host: HTMLElement; // where the <svg> filter node is appended
}

const NEUTRAL = 0.5019607843137255; // 128/255 — the flood's blue, cancels spec outside the lens

export function mountSvgRipple(o: SvgRippleOptions) {
  const id = 'svgr-' + Math.random().toString(36).slice(2, 8);
  // Live params — frame() reads these each tick, so reconfigure() takes effect immediately.
  const cfg: SvgRippleParams = {
    duration: o.duration ?? 1100,
    strength: o.strength ?? 24,
    chroma: o.chroma ?? 0.4,
    spec: o.spec ?? 0.7,
    maxFrac: o.maxFrac ?? 0.85,
    blur: o.blur ?? 0.4,
  };

  // One fixed circular dome map; the feImage stretches it to the growing ellipse.
  const MAP = 128;
  const mapUrl = buildDisplacementMap({ width: MAP, height: MAP, radius: MAP / 2, depth: 16, dome: 14, edge: 0.5, glow: 0.78 });

  const holder = document.createElement('div');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  holder.innerHTML =
    `<svg width="0" height="0" aria-hidden="true"><filter id="${id}" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
    `<feFlood flood-color="rgb(128,128,128)" flood-opacity="1" result="mapBg"></feFlood>` +
    `<feImage href="${mapUrl}" xlink:href="${mapUrl}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="rawMap"></feImage>` +
    `<feComposite in="rawMap" in2="mapBg" operator="over" result="map"></feComposite>` +
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${cfg.blur}" result="blurred"></feGaussianBlur>` +
    `<feDisplacementMap in="blurred" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
    `<feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispR"></feColorMatrix>` +
    `<feDisplacementMap in="blurred" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispG"></feColorMatrix>` +
    `<feDisplacementMap in="blurred" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="dispB"></feColorMatrix>` +
    `<feComposite in="dispR" in2="dispG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"></feComposite>` +
    `<feComposite in2="dispB" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lensResult"></feComposite>` +
    `<feColorMatrix in="map" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 ${cfg.spec} 0 ${-NEUTRAL * cfg.spec}" result="specMask"></feColorMatrix>` +
    `<feComposite in="specMask" in2="lensResult" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"></feComposite>` +
    `</filter></svg>`;
  o.host.appendChild(holder);

  const feImage = holder.querySelector('feImage')!;
  const feBlur = holder.querySelector('feGaussianBlur')!;
  const dm = Array.from(holder.querySelectorAll('feDisplacementMap'));
  const spec = holder.querySelector<SVGFEColorMatrixElement>('[result="specMask"]')!;

  let cx = 0;
  let cy = 0;
  let bw = 0;
  let bh = 0;
  let t0 = 0;
  let active = false;
  let raf = 0;
  let colorIndex = 0;
  let col: [number, number, number] = [1, 1, 1];

  const easeOut = (p: number) => 1 - Math.pow(1 - p, 3); // Aave's lens curve — shoots out, settles

  const frame = (now: number) => {
    const p = Math.min(1, (now - t0) / cfg.duration);
    const g = easeOut(p);
    const halfX = Math.max(0.5, g * cfg.maxFrac * bw); // elliptical — matches the button aspect
    const halfY = Math.max(0.5, g * cfg.maxFrac * bh);
    const strength = cfg.strength * (1 - p); // fades as it expands
    const f = 1 - p; // glint/colour fade
    feImage.setAttribute('x', String(cx - halfX));
    feImage.setAttribute('y', String(cy - halfY));
    feImage.setAttribute('width', String(2 * halfX));
    feImage.setAttribute('height', String(2 * halfY));
    dm[0].setAttribute('scale', String(strength * (1 + cfg.chroma * 2))); // R — widest split
    dm[1].setAttribute('scale', String(strength * (1 + cfg.chroma)));
    dm[2].setAttribute('scale', String(strength));
    // palette colour rides the specular glint (premultiplied → gated to the rim), fading with age
    spec.setAttribute('values', `0 0 0 0 ${col[0]}  0 0 0 0 ${col[1]}  0 0 0 0 ${col[2]}  0 0 ${cfg.spec * f} 0 ${-NEUTRAL * cfg.spec * f}`);
    if (p >= 1) {
      active = false;
      o.target.style.filter = '';
      o.target.style.removeProperty('-webkit-filter');
      return;
    }
    raf = requestAnimationFrame(frame);
  };

  return {
    // nx, ny normalised 0..1 within the target
    press(nx: number, ny: number) {
      const r = o.target.getBoundingClientRect();
      bw = r.width;
      bh = r.height;
      cx = nx * bw;
      cy = ny * bh;
      col = hexToRgb(SPLASH_COLORS[colorIndex]);
      colorIndex = (colorIndex + 1) % SPLASH_COLORS.length;
      t0 = performance.now();
      o.target.style.filter = `url(#${id})`;
      o.target.style.setProperty('-webkit-filter', `url(#${id})`);
      if (!active) {
        active = true;
        raf = requestAnimationFrame(frame);
      }
    },
    reconfigure(patch: Partial<SvgRippleParams>) {
      Object.assign(cfg, patch);
      if ('blur' in patch) feBlur.setAttribute('stdDeviation', String(cfg.blur)); // filter attr, update live
    },
    getOptions(): SvgRippleParams {
      return { ...cfg };
    },
    dispose() {
      cancelAnimationFrame(raf);
      holder.remove();
      o.target.style.filter = '';
      o.target.style.removeProperty('-webkit-filter');
    },
  };
}
