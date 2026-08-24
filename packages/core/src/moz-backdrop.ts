// Live backdrop refraction for Gecko — the `behind` path.
//
// Firefox is the one engine with `element()` (still `-moz-element()`): any
// element can be painted as a LIVE image in another element's background. That
// closes the one case the library couldn't reach outside Chromium — glass
// floating over arbitrary page content it doesn't own (the navbar case).
// Chromium serves that case with `backdrop-filter: url()`; WebKit has nothing
// (bug 245510) and stays on the frosted blur. Here the surface's background IS
// the source element, alive — things scrolling, animating or playing beneath
// the glass show through bent, with no clone to keep in sync and no snapshot
// to go stale.
//
// Mechanics: the painted image's natural size is the source's border box,
// drawn from its top-left. Aligning the slice under the glass is therefore
// pure `background-position` — the source's viewport offset minus the
// surface's — rewritten (rAF-coalesced) on scroll and resize. Style writes
// only; the pixels are always current because they are the real element.
//
// This module is lazy-imported behind a capability probe, exactly like the
// WebGL escape hatch: non-Gecko users download none of it, which is also the
// honest answer to "does -moz-element tree-shake?" — bundlers can't know the
// runtime engine, so the split has to be ours.
//
// One caveat, documented rather than fought: point `behind` at a SIBLING
// scene (the page's content wrapper), not an ancestor of the glass. Gecko
// breaks the paint cycle when the referenced element contains the reference,
// but the glass then sits over a backdrop with a hole where it itself would
// be. A navbar over a sibling <main> — the case this exists for — has no
// cycle.

import { buildDisplacementMap, type MapProfile } from './displacement';
import { specMaskValues } from './map-encode';
import { preBlurStd } from './blur-quantize';

/** The refraction params this path reads (a structural subset of mount's P). */
export interface MozBackdropParams {
  radius: number;
  depth: number;
  profile: MapProfile;
  dome: number;
  strength: number;
  edge: number;
  glow: number;
  chroma: number;
  blur: number;
}

const MARGIN = 28; // keep in lock-step with mount.ts's bleed

let uid = 0;

/**
 * Refract `source` — live — behind `el`, painting into `surface`.
 * Returns the cleanup. Gecko-only; callers gate on
 * `CSS.supports('background-image', '-moz-element(#a)')`.
 */
export function mountMozBackdrop(
  el: HTMLElement,
  surface: HTMLElement,
  p: MozBackdropParams,
  source: HTMLElement,
): () => void {
  const base = el.dataset.uid || 'g';
  const id = `${base}-moz`;
  if (!source.id) source.id = `ps-behind-${++uid}`;
  const s1 = p.strength * (1 + 0.2 * p.chroma);
  const s2 = p.strength * (1 + 0.1 * p.chroma);
  const s3 = p.strength;

  surface.style.cssText =
    `position:absolute;inset:-${MARGIN}px;pointer-events:none;` +
    `background-image:-moz-element(#${source.id});background-repeat:no-repeat;` +
    `filter:url(#${id})`;

  const holder = document.createElement('div');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  el.appendChild(holder);
  const rebuildFilter = (w: number, h: number, radius: number) => {
    // Explicit userSpaceOnUse region + feImage subregion — the house standard
    // since the implicit form proved non-interoperable (see mountDomRefract).
    const fw = w + 2 * MARGIN;
    const fh = h + 2 * MARGIN;
    const map = buildDisplacementMap({
      width: w,
      height: h,
      radius,
      depth: p.depth,
      profile: p.profile,
      dome: p.dome,
      edge: p.edge,
      glow: p.glow,
      margin: MARGIN,
    });
    holder.innerHTML =
      `<svg width="0" height="0" aria-hidden="true"><filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${fw}" height="${fh}" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
      `<feFlood flood-color="rgb(128,128,128)" flood-opacity="1" result="mapBg"></feFlood>` +
      `<feImage href="${map}" xlink:href="${map}" x="0" y="0" width="${fw}" height="${fh}" preserveAspectRatio="none" result="rawMap"></feImage>` +
      `<feComposite in="rawMap" in2="mapBg" operator="over" result="map"></feComposite>` +
      `<feGaussianBlur in="SourceGraphic" stdDeviation="${preBlurStd(p.blur)}" result="blurred"></feGaussianBlur>` +
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
  };

  // The map regenerates on shape change; the background-position rewrites on
  // every scroll/resize tick. Distinct cadences, one rAF for the cheap one.
  let lastShape = '';
  const reshape = () => {
    const w = Math.round(el.offsetWidth || el.getBoundingClientRect().width);
    const h = Math.round(el.offsetHeight || el.getBoundingClientRect().height);
    if (!w || !h) return;
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    const key = `${w}x${h}x${radius}`;
    if (key === lastShape) return;
    lastShape = key;
    rebuildFilter(w, h, radius);
  };

  let raf = 0;
  const reposition = () => {
    raf = 0;
    const sr = source.getBoundingClientRect();
    const gr = surface.getBoundingClientRect();
    surface.style.backgroundPosition = `${sr.left - gr.left}px ${sr.top - gr.top}px`;
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(reposition);
  };

  reshape();
  reposition();
  const ro = new ResizeObserver(() => {
    reshape();
    schedule();
  });
  ro.observe(el);
  ro.observe(source);
  // Capture phase so nested scrollers between the source and the viewport are
  // heard too, not only the document's own scroll.
  addEventListener('scroll', schedule, { capture: true, passive: true });

  return () => {
    removeEventListener('scroll', schedule, { capture: true });
    cancelAnimationFrame(raf);
    ro.disconnect();
    holder.remove();
    surface.style.cssText = '';
  };
}
