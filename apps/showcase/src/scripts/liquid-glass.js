import { buildDisplacementMap } from "@liquidglassjs/core";
const MARGIN = 28;
const SPEC_LO = 0.25;
const SPEC_HI = 0.7;
const n = (el, k, d) => {
  const v = Number(el.dataset[k]);
  return Number.isNaN(v) ? d : v;
};
const params = (el) => ({
  radius: n(el, "radius", 22),
  depth: n(el, "depth", 20),
  dome: n(el, "dome", 14),
  strength: n(el, "strength", 16),
  edge: n(el, "edge", 0.8),
  glow: n(el, "glow", 0.2),
  chroma: n(el, "chroma", 0.3),
  blur: n(el, "blur", 2),
  spec: n(el, "spec", 0.9),
  vibrancy: n(el, "vibrancy", 0.15),
  backdrop: el.dataset.backdrop || "",
  source: el.dataset.source || ""
});
let _webgl2OK;
function webgl2OK() {
  if (_webgl2OK !== void 0)
    return _webgl2OK;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    _webgl2OK = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    _webgl2OK = false;
  }
  return _webgl2OK;
}
function mountSvg(el, surface, p) {
  const uid = el.dataset.uid || "g";
  const s1 = p.strength * (1 + 0.2 * p.chroma);
  const s2 = p.strength * (1 + 0.1 * p.chroma);
  const s3 = p.strength;
  surface.style.cssText = `position:absolute;inset:-${MARGIN}px;pointer-events:none;background-color:var(--paper);background-image:${p.backdrop};background-position:center top;background-repeat:no-repeat;background-attachment:fixed;background-size:cover;filter:url(#${uid})`;
  const holder = document.createElement("div");
  holder.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  holder.innerHTML = `<svg width="0" height="0" aria-hidden="true"><filter id="${uid}" x="0" y="0" width="1" height="1" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-color="rgb(128,128,128)" flood-opacity="1" result="mapBg"></feFlood><feImage class="ps-glass__map" preserveAspectRatio="none" result="rawMap"></feImage><feComposite in="rawMap" in2="mapBg" operator="over" result="map"></feComposite><feGaussianBlur in="SourceGraphic" stdDeviation="${p.blur}" result="blurred"></feGaussianBlur><feDisplacementMap in="blurred" in2="map" scale="${s1}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap><feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispR"></feColorMatrix><feDisplacementMap in="blurred" in2="map" scale="${s2}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap><feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispG"></feColorMatrix><feDisplacementMap in="blurred" in2="map" scale="${s3}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="dispB"></feColorMatrix><feComposite in="dispR" in2="dispG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"></feComposite><feComposite in2="dispB" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lensResult"></feComposite><feColorMatrix in="map" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 1 0 -0.5019607843137255" result="specMask"></feColorMatrix><feComposite in="specMask" in2="lensResult" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"></feComposite></filter></svg>`;
  el.appendChild(holder);
  const map = holder.querySelector("feImage");
  let last = "";
  const render = () => {
    const r = el.getBoundingClientRect();
    const width = Math.round(r.width);
    const height = Math.round(r.height);
    if (!width || !height)
      return;
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    const key = `${width}x${height}x${radius}`;
    if (key === last)
      return;
    last = key;
    const href = buildDisplacementMap({ width, height, radius, depth: p.depth, dome: p.dome, edge: p.edge, glow: p.glow, margin: MARGIN });
    map.setAttribute("href", href);
    map.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", href);
  };
  render();
  new ResizeObserver(render).observe(el);
  const blurNode = holder.querySelector("feGaussianBlur");
  const dispNodes = holder.querySelectorAll("feDisplacementMap");
  return () => {
    blurNode?.setAttribute("stdDeviation", String(p.blur));
    dispNodes[0]?.setAttribute("scale", String(p.strength * (1 + 0.2 * p.chroma)));
    dispNodes[1]?.setAttribute("scale", String(p.strength * (1 + 0.1 * p.chroma)));
    dispNodes[2]?.setAttribute("scale", String(p.strength));
    last = "";
    render();
  };
}
async function mountWebgl(el, surface, p, src, reg) {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  surface.appendChild(canvas);
  let glass;
  try {
    const { GlassGL } = await import("@liquidglassjs/core/webgl");
    glass = new GlassGL(canvas, {
      radius: p.radius,
      depth: p.depth,
      dome: p.dome,
      strength: p.strength,
      chroma: p.chroma,
      frost: p.blur,
      spec: p.spec,
      vibrancy: p.vibrancy,
      specLo: SPEC_LO,
      specHi: SPEC_HI
    });
  } catch (err) {
    console.warn("[liquid-glass] WebGL glass failed to initialise; falling back to frost.", err);
    canvas.remove();
    el.dataset.render = "frost";
    reg(mountFrost(el, surface, p));
    return;
  }
  const anySrc = src;
  const sw = () => anySrc.videoWidth || anySrc.naturalWidth || anySrc.width || anySrc.clientWidth || 1;
  const sh = () => anySrc.videoHeight || anySrc.naturalHeight || anySrc.height || anySrc.clientHeight || 1;
  glass.setBackdrop(src, sw(), sh());
  reg(() => {
    glass.cfg.strength = p.strength;
    glass.cfg.chroma = p.chroma;
    glass.cfg.depth = p.depth;
    glass.cfg.dome = p.dome;
    glass.cfg.frost = p.blur;
    glass.cfg.spec = p.spec;
    glass.cfg.vibrancy = p.vibrancy;
    glass.bakeMap(); // re-bake displacement (dome/depth); edge/glow are baked fixed
    glass.markBlurDirty();
  });
  let visible = true;
  new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
  }).observe(el);
  let srcKey = "";
  let lensKey = "";
  const frame = () => {
    requestAnimationFrame(frame);
    if (!visible)
      return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (!cw || !ch)
      return;
    const sk = `${sw()}x${sh()}`;
    if (sk !== srcKey) {
      srcKey = sk;
      glass.setBackdrop(src, sw(), sh());
    } else
      glass.updateSource(src);
    const lk = `${cw}x${ch}`;
    if (lk !== lensKey) {
      lensKey = lk;
      glass.resize();
      glass.center = [cw / 2, ch / 2];
      glass.half = [cw / 2, ch / 2];
      glass.cfg.radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || p.radius;
      glass.bakeMap();
    }
    const g = el.getBoundingClientRect();
    const b = src.getBoundingClientRect();
    glass.view = { x: b.left - g.left, y: b.top - g.top, w: b.width, h: b.height };
    glass.render();
  };
  requestAnimationFrame(frame);
}
function supportsBackdropUrl() {
  try {
    return typeof CSS !== "undefined" && CSS.supports("backdrop-filter", 'url("#a")');
  } catch {
    return false;
  }
}
// Frost. Chromium is the only engine that supports `backdrop-filter: url()`; where it
// is, we run the SAME feDisplacementMap over the live page behind the surface, so a
// fixed element (e.g. the nav) actually REFRACTS the content scrolling under it —
// not a flat blur. Everywhere else, fall back to a plain frosted blur.
// The surface fill is `--glass-frost` (falls back to `--paper-blur`), so a caller that
// wants the refraction to read through can set a lighter, more transparent tint.
function mountFrost(el, surface, p) {
  const frostCss = (filter) =>
    `position:absolute;inset:-${MARGIN}px;pointer-events:none;background:var(--glass-frost, var(--paper-blur));backdrop-filter:${filter};-webkit-backdrop-filter:${filter}`;
  if (!supportsBackdropUrl()) {
    const apply = () => {
      const blur = Math.max(6, p.blur * 2); // frost only honors blur here
      surface.style.cssText = frostCss(`blur(${blur}px) saturate(1.3)`);
    };
    apply();
    return apply;
  }
  // Refractive frost (Chromium): displace the backdrop through the dome map — the same
  // optics mountDomRefract runs on live DOM, only here the filter's Source is the page
  // behind the surface. Rebuild on resize; force one on reconfigure (`last = ""`).
  const base = el.dataset.uid || "g";
  let holder = null;
  let last = "";
  let n2 = 0;
  const render = () => {
    const r = el.getBoundingClientRect();
    const width = Math.round(r.width);
    const height = Math.round(r.height);
    if (!width || !height)
      return;
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    const key = `${width}x${height}x${radius}`;
    if (key === last)
      return;
    last = key;
    const frostBlur = Math.max(2, p.blur * 2);
    const s1 = p.strength * (1 + 0.2 * p.chroma);
    const s2 = p.strength * (1 + 0.1 * p.chroma);
    const s3 = p.strength;
    const id = `${base}-frost-${++n2}`;
    const map = buildDisplacementMap({ width, height, radius, depth: p.depth, dome: p.dome, edge: p.edge, glow: p.glow, margin: MARGIN });
    const svg = document.createElement("div");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    svg.innerHTML = `<svg width="0" height="0" aria-hidden="true"><filter id="${id}" x="0" y="0" width="1" height="1" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-color="rgb(128,128,128)" flood-opacity="1" result="mapBg"></feFlood><feImage href="${map}" xlink:href="${map}" preserveAspectRatio="none" result="rawMap"></feImage><feComposite in="rawMap" in2="mapBg" operator="over" result="map"></feComposite><feGaussianBlur in="SourceGraphic" stdDeviation="${frostBlur}" result="blurred"></feGaussianBlur><feDisplacementMap in="blurred" in2="map" scale="${s1}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap><feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispR"></feColorMatrix><feDisplacementMap in="blurred" in2="map" scale="${s2}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap><feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispG"></feColorMatrix><feDisplacementMap in="blurred" in2="map" scale="${s3}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="dispB"></feColorMatrix><feComposite in="dispR" in2="dispG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"></feComposite><feComposite in2="dispB" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lensResult"></feComposite><feColorMatrix in="map" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 1 0 -0.5019607843137255" result="specMask"></feColorMatrix><feComposite in="specMask" in2="lensResult" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"></feComposite></filter></svg>`;
    el.appendChild(svg);
    surface.style.cssText = frostCss(`url(#${id}) saturate(1.2)`);
    if (holder)
      holder.remove();
    holder = svg;
  };
  render();
  new ResizeObserver(render).observe(el);
  return () => {
    last = ""; // force a rebuild with the reconfigured params even if the box is unchanged
    render();
  };
}
function mountDomRefract(el, refract, p) {
  const base = el.dataset.uid || "g";
  let holder = null;
  let last = "";
  let n2 = 0;
  const render = () => {
    const r = el.getBoundingClientRect();
    const width = Math.round(r.width);
    const height = Math.round(r.height);
    if (!width || !height)
      return;
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    const key = `${width}x${height}x${radius}`;
    if (key === last)
      return;
    last = key;
    const s1 = p.strength * (1 + 0.2 * p.chroma);
    const s2 = p.strength * (1 + 0.1 * p.chroma);
    const s3 = p.strength;
    const id = `${base}-${++n2}`;
    const map = buildDisplacementMap({ width, height, radius, depth: p.depth, dome: p.dome, edge: p.edge, glow: p.glow, margin: MARGIN });
    const svg = document.createElement("div");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    svg.innerHTML = `<svg width="0" height="0" aria-hidden="true"><filter id="${id}" x="0" y="0" width="1" height="1" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-color="rgb(128,128,128)" flood-opacity="1" result="mapBg"></feFlood><feImage href="${map}" xlink:href="${map}" preserveAspectRatio="none" result="rawMap"></feImage><feComposite in="rawMap" in2="mapBg" operator="over" result="map"></feComposite><feGaussianBlur in="SourceGraphic" stdDeviation="${p.blur}" result="blurred"></feGaussianBlur><feDisplacementMap in="blurred" in2="map" scale="${s1}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap><feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispR"></feColorMatrix><feDisplacementMap in="blurred" in2="map" scale="${s2}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap><feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispG"></feColorMatrix><feDisplacementMap in="blurred" in2="map" scale="${s3}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="dispB"></feColorMatrix><feComposite in="dispR" in2="dispG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"></feComposite><feComposite in2="dispB" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lensResult"></feComposite><feColorMatrix in="map" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 1 0 -0.5019607843137255" result="specMask"></feColorMatrix><feComposite in="specMask" in2="lensResult" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"></feComposite></filter></svg>`;
    el.appendChild(svg);
    refract.style.filter = `url(#${id})`;
    refract.style.setProperty("-webkit-filter", `url(#${id})`);
    if (holder)
      holder.remove();
    holder = svg;
  };
  render();
  new ResizeObserver(render).observe(el);
  return () => {
    last = ""; // force a rebuild even though the shape is unchanged
    render();
  };
}
function mount(el) {
  const surface = el.querySelector(".ps-glass__surface");
  if (!surface)
    return;
  const p = params(el);
  let apply = () => {};
  const reg = (f) => { apply = f; };
  const refract = el.querySelector(".ps-glass__refract");
  if (refract) {
    el.dataset.render = "svg";
    apply = mountDomRefract(el, refract, p);
  } else {
    let mode = el.dataset.mode || "auto";
    let src = null;
    if (p.source) {
      try {
        src = document.querySelector(p.source);
      } catch {
        src = null;
      }
    }
    const canWebgl = !!src && webgl2OK();
    if (mode === "auto")
      mode = canWebgl ? "webgl" : p.backdrop ? "svg" : "frost";
    if (mode === "webgl" && src && webgl2OK()) {
      el.dataset.render = "webgl";
      void mountWebgl(el, surface, p, src, reg);
    } else if (mode === "svg" && p.backdrop) {
      el.dataset.render = "svg";
      apply = mountSvg(el, surface, p);
    } else {
      el.dataset.render = "frost";
      apply = mountFrost(el, surface, p);
    }
  }
  // Expose a live reconfigure handle for the Tuner (Render paths section). Each path's
  // `apply` re-reads `p`; keys a path can't honor are simply never read by its apply.
  el.__glass = {
    reconfigure(patch) {
      for (const k of ["radius", "depth", "dome", "strength", "edge", "glow", "chroma", "blur", "spec", "vibrancy"]) {
        const v = patch[k];
        if (typeof v === "number" && !Number.isNaN(v)) p[k] = v;
      }
      if (typeof patch.radius === "number") el.style.setProperty("--g-radius", patch.radius + "px");
      apply();
    }
  };
}
// body.html is a saved live-DOM snapshot. If a re-capture bakes runtime state
// back in, its capture-time <filter> holders would collide with the stable
// data-uid ids minted here (url(#id) resolves first-in-tree, so a baked def
// shadows every live update — the Tuner moves sliders and nothing happens).
// This runs before any glass mounts, so every zero-size filter-plumbing svg
// in the document at this point is snapshot residue: drop it.
document.querySelectorAll('svg[width="0"][height="0"][aria-hidden="true"]').forEach((svg) => {
  if (!svg.querySelector("filter")) return;
  const holder = svg.parentElement;
  if (holder && holder.tagName === "DIV") holder.remove();
  else svg.remove();
});
document.querySelectorAll("[data-glass]").forEach(mount);