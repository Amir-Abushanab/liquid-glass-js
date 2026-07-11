// Morphing liquid-glass surface — a glass panel whose SIZE and refraction
// STRENGTH animate cheaply, for two things Aave ships but this package didn't
// have yet: a button that reshapes when its label changes, and a dropdown that
// materializes open.
//
// The technique is the one `svg-ripple.ts` already proved, generalized: keep a
// SINGLE displacement map and animate only cheap filter attributes per frame —
// the `<feImage>` geometry (position + stretch), the three chroma
// `feDisplacementMap` scales, and the specular alpha. The map is regenerated
// (with a FRESH filter id, so Safari doesn't serve its cached output) only when
// the size SETTLES, so the moving frames are cheap and the rest state is crisp.
//
// This mirrors Aave's actual menu engine: their lens carries `displScale` and
// `regionScale` motion values on a pooled filter — `displScale: 0` is clear
// glass, and ramping it up "materializes" the refraction as the surface opens.
// We drive the same two ideas: `setDisplScale(0..1)` fades the refraction in,
// and `setBox()` stretches the region during a morph.

import { buildDisplacementMap } from './displacement';
import { NEUTRAL } from './map-encode';

// The live-tunable refraction params (everything except the box geometry).
export interface GlassSurfaceParams {
  depth: number; // SDF inset before the erf edge falloff, px
  dome: number; // interior meniscus swell, px sagitta
  edge: number; // rim glint strength
  glow: number; // soft axial sheen strength
  strength: number; // peak displacement, px
  chroma: number; // per-channel (R/G/B) split amount
  blur: number; // source pre-blur, px (glassiness)
  spec: number; // specular-glint strength
}

export const GLASS_SURFACE_DEFAULTS: GlassSurfaceParams = {
  depth: 10,
  dome: 12,
  edge: 0.9,
  glow: 0.3,
  strength: 16,
  chroma: 0.4,
  blur: 0.4,
  spec: 0.7,
};

export interface GlassSurfaceOptions extends Partial<GlassSurfaceParams> {
  host: HTMLElement; // where the hidden <svg><filter> lives
  target: HTMLElement; // the live pane that gets filter:url() — the thing that bends
  width: number;
  height: number;
  radius: number;
  active?: boolean; // apply the filter immediately? (default true)
}

// A resizable, fade-able glass filter over one live element.
export interface GlassSurface {
  /** Rebuild the map at an exact size (fresh id — the crisp settle state). */
  regenerate(width: number, height: number, radius: number): void;
  /** Cheap per-frame stretch of the current map to a new box (no regen). */
  setBox(width: number, height: number): void;
  /** 0 = clear glass, 1 = full refraction. Fades displacement + glint together. */
  setDisplScale(frac: number): void;
  /** Resolves once the current map bitmap has decoded. Await before revealing a
   *  surface so its first painted frame carries the glass, not the flat fallback. */
  whenReady(): Promise<void>;
  setActive(on: boolean): void;
  reconfigure(patch: Partial<GlassSurfaceParams>): void;
  getOptions(): GlassSurfaceParams;
  dispose(): void;
}

// The chroma filter chain, verbatim in spirit from svg-ripple / glass-lens:
// blur → 3 displacement passes (R/G/B, widening split) → recombine → add the
// spec glint. `feImage` covers the box in userSpaceOnUse px; the map's own
// edges are neutral (128) so anything outside the rounded-rect passes straight
// through. Displacement near the rim points INWARD (magnification), so the pane
// filling the box is enough — no bleed margin needed (same as glass-lens).
function filterHTML(
  id: string,
  w: number,
  h: number,
  blur: number,
  mapUrl: string,
  s1: number,
  s2: number,
  s3: number,
  specAlpha: number,
): string {
  return (
    `<svg width="0" height="0" aria-hidden="true"><filter id="${id}" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
    `<feFlood flood-color="rgb(128,128,128)" flood-opacity="1" result="mapBg"></feFlood>` +
    `<feImage href="${mapUrl}" xlink:href="${mapUrl}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="rawMap"></feImage>` +
    `<feComposite in="rawMap" in2="mapBg" operator="over" result="map"></feComposite>` +
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="blurred"></feGaussianBlur>` +
    `<feDisplacementMap in="blurred" in2="map" scale="${s1}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
    `<feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispR"></feColorMatrix>` +
    `<feDisplacementMap in="blurred" in2="map" scale="${s2}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="dispG"></feColorMatrix>` +
    `<feDisplacementMap in="blurred" in2="map" scale="${s3}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="dispB"></feColorMatrix>` +
    `<feComposite in="dispR" in2="dispG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"></feComposite>` +
    `<feComposite in2="dispB" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lensResult"></feComposite>` +
    `<feColorMatrix in="map" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 ${specAlpha} 0 ${-NEUTRAL * specAlpha}" result="specMask"></feColorMatrix>` +
    `<feComposite in="specMask" in2="lensResult" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"></feComposite>` +
    `</filter></svg>`
  );
}

export function createGlassSurface(o: GlassSurfaceOptions): GlassSurface {
  const base = 'gm-' + Math.random().toString(36).slice(2, 8);
  const cur: GlassSurfaceParams = {
    depth: o.depth ?? GLASS_SURFACE_DEFAULTS.depth,
    dome: o.dome ?? GLASS_SURFACE_DEFAULTS.dome,
    edge: o.edge ?? GLASS_SURFACE_DEFAULTS.edge,
    glow: o.glow ?? GLASS_SURFACE_DEFAULTS.glow,
    strength: o.strength ?? GLASS_SURFACE_DEFAULTS.strength,
    chroma: o.chroma ?? GLASS_SURFACE_DEFAULTS.chroma,
    blur: o.blur ?? GLASS_SURFACE_DEFAULTS.blur,
    spec: o.spec ?? GLASS_SURFACE_DEFAULTS.spec,
  };

  let mapW = Math.max(1, Math.round(o.width));
  let mapH = Math.max(1, Math.round(o.height));
  let radius = o.radius;
  let frac = 1; // current displacement fraction (0..1)
  let n = 0;
  let active = o.active ?? true;
  let curId = '';
  let holder: HTMLElement | null = null;
  let feImage: SVGFEImageElement | null = null;
  let dm: SVGFEDisplacementMapElement[] = [];
  let spec: SVGFEColorMatrixElement | null = null;
  let ready: Promise<void> = Promise.resolve();

  // Push the current `frac` into the three displacement scales + the spec alpha.
  const applyScales = () => {
    const s = cur.strength * frac;
    dm[0]?.setAttribute('scale', String(s * (1 + 0.2 * cur.chroma)));
    dm[1]?.setAttribute('scale', String(s * (1 + 0.1 * cur.chroma)));
    dm[2]?.setAttribute('scale', String(s));
    const a = cur.spec * frac;
    spec?.setAttribute('values', `0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 ${a} 0 ${-NEUTRAL * a}`);
  };

  const rebuild = () => {
    const id = `${base}-${++n}`; // fresh id every rebuild (Safari filter-cache bust)
    const mapUrl = buildDisplacementMap({
      width: mapW,
      height: mapH,
      radius,
      depth: cur.depth,
      dome: cur.dome,
      edge: cur.edge,
      glow: cur.glow,
    });
    // Pre-decode the map bitmap so the <feImage> is ready on the surface's first
    // paint. Until it decodes, the filter's neutral-gray flood stands in for the
    // map (zero displacement), so the pane renders FLAT for a frame or two before
    // the glass snaps in. Callers await whenReady() to hold a reveal until then.
    const warm = new Image();
    warm.src = mapUrl;
    ready = (typeof warm.decode === 'function' ? warm.decode() : Promise.resolve()).catch(() => {});
    const s = cur.strength * frac;
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    div.innerHTML = filterHTML(
      id,
      mapW,
      mapH,
      cur.blur,
      mapUrl,
      s * (1 + 0.2 * cur.chroma),
      s * (1 + 0.1 * cur.chroma),
      s,
      cur.spec * frac,
    );
    o.host.appendChild(div);
    curId = id;
    feImage = div.querySelector('feImage');
    dm = Array.from(div.querySelectorAll('feDisplacementMap'));
    spec = div.querySelector<SVGFEColorMatrixElement>('[result="specMask"]');
    if (active) {
      o.target.style.filter = `url(#${id})`;
      o.target.style.setProperty('-webkit-filter', `url(#${id})`);
    }
    if (holder) holder.remove();
    holder = div;
  };

  rebuild();

  return {
    regenerate(width, height, r) {
      mapW = Math.max(1, Math.round(width));
      mapH = Math.max(1, Math.round(height));
      radius = r;
      rebuild();
    },
    setBox(width, height) {
      // Cheap: stretch the fixed map into the new box (no regenerate). The
      // `feImage` maps the whole map into x/y/width/height, so a differing
      // aspect momentarily distorts the dome — that transient IS the liquid
      // wobble; `regenerate()` on settle restores an exact map.
      feImage?.setAttribute('width', String(Math.max(1, width)));
      feImage?.setAttribute('height', String(Math.max(1, height)));
    },
    setDisplScale(f) {
      // Ceiling above 1 so callers can briefly over-refract (the button's
      // mid-morph liquid kick / the dropdown's open overshoot).
      frac = Math.max(0, Math.min(1.8, f));
      applyScales();
    },
    whenReady: () => ready,
    setActive(on) {
      active = on;
      if (on && curId) {
        o.target.style.filter = `url(#${curId})`;
        o.target.style.setProperty('-webkit-filter', `url(#${curId})`);
      } else {
        o.target.style.filter = '';
        o.target.style.removeProperty('-webkit-filter');
      }
    },
    reconfigure(patch) {
      Object.assign(cur, patch);
      rebuild();
    },
    getOptions() {
      return { ...cur };
    },
    dispose() {
      holder?.remove();
      o.target.style.filter = '';
      o.target.style.removeProperty('-webkit-filter');
    },
  };
}

// ── easing (self-contained; overshoot for the liquid spring) ──
// A cubic-bezier with a control point y > 1 overshoots then settles — the same
// snap the segmented control uses. Kept local so glass-morph has no dep on
// dynamics.ts beyond what it needs.
function overshoot(t: number): number {
  // ~cubic-bezier(0.34, 1.4, 0.5, 1), sampled cheaply: ease-out with a spring tail.
  const c = 1.70158 * 1.35;
  const p = t - 1;
  return 1 + p * p * ((c + 1) * p + c);
}
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const prefersReduced = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─────────────────────────────────────────────────────────────────────────────
// Glass button — reshapes when its content changes
// ─────────────────────────────────────────────────────────────────────────────

export interface GlassButtonOptions extends Partial<GlassSurfaceParams> {
  radius?: number; // corner radius; omit/0 → pill (height / 2)
  duration?: number; // morph duration, ms (default 460)
  pulse?: number; // extra refraction kick mid-morph, 0..1 (default 0.5)
  backdrop?: string; // CSS background for the refracted pane (defaults to a soft glass gradient)
}

export interface GlassButton {
  readonly el: HTMLElement;
  /**
   * Swap the label and morph the button to fit it. Resolves when the morph ends.
   * Pass `immediate` to set content with no crossfade/tween (e.g. initial state).
   */
  setContent(content: string | Node, immediate?: boolean): Promise<void>;
  reconfigure(patch: Partial<GlassSurfaceParams>): void;
  getOptions(): GlassSurfaceParams;
  dispose(): void;
}

const BTN_BG =
  'linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0) 60%),' +
  'radial-gradient(120% 80% at 50% 10%,rgba(140,123,255,0.30),rgba(140,123,255,0) 70%),' +
  'repeating-linear-gradient(0deg,rgba(200,210,255,0.07) 0 1px,transparent 1px 13px),' +
  'repeating-linear-gradient(90deg,rgba(200,210,255,0.07) 0 1px,transparent 1px 13px),' +
  'linear-gradient(180deg,#191426,#0b0912)';

/**
 * Mount a liquid-glass button on `el` whose glass reshapes when its label
 * changes. `el` should be a positioned button; its initial text/children become
 * the first label. Import `@liquidglassjs/core/css` for the chrome.
 */
export function mountGlassButton(el: HTMLElement, opts: GlassButtonOptions = {}): GlassButton {
  el.classList.add('gm-btn');
  const duration = opts.duration ?? 460;
  const pulse = opts.pulse ?? 0.5;

  // Structure: [bg pane (refracted)] [label (crisp, drives width)].
  const bg = document.createElement('span');
  bg.className = 'gm-btn__bg';
  bg.style.background = opts.backdrop ?? BTN_BG;

  const label = document.createElement('span');
  label.className = 'gm-btn__label';
  // Move whatever was already inside into the label.
  while (el.firstChild) label.appendChild(el.firstChild);
  el.prepend(bg);
  el.appendChild(label);

  const rectOf = () => el.getBoundingClientRect();
  const r0 = rectOf();
  let height = Math.round(r0.height) || 44;
  const radius = () => (opts.radius && opts.radius > 0 ? opts.radius : height / 2);

  const surface = createGlassSurface({
    host: el,
    target: bg,
    width: Math.round(r0.width) || 120,
    height,
    radius: radius(),
    depth: opts.depth,
    dome: opts.dome,
    edge: opts.edge,
    glow: opts.glow,
    strength: opts.strength,
    chroma: opts.chroma,
    blur: opts.blur,
    spec: opts.spec,
  });

  // Pin the button to its measured width so a content swap animates from a
  // number, not from `auto`.
  el.style.width = `${Math.round(r0.width)}px`;

  let raf = 0;
  let safety = 0;

  // Measure the natural width the button would take for `nextLabel`'s content,
  // using an offscreen clone so we never flash the new content early.
  const measureWidth = (node: Node): number => {
    const probe = label.cloneNode(false) as HTMLElement;
    probe.style.cssText =
      'position:absolute;left:-9999px;top:0;visibility:hidden;width:auto;white-space:nowrap';
    probe.appendChild(node.cloneNode(true));
    el.appendChild(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    // width = content + the button's horizontal padding (label is inset:0 flex-centered)
    const cs = getComputedStyle(el);
    const padX = parseFloat(cs.paddingLeft || '0') + parseFloat(cs.paddingRight || '0');
    return Math.ceil(w + padX);
  };

  const setContent = (content: string | Node, immediate = false): Promise<void> => {
    // Interrupt any in-flight morph and chase the newest target from the current
    // width — rapid swaps feel responsive instead of queueing up. Drop any
    // still-fading clone from a previous swap so labels never stack up.
    cancelAnimationFrame(raf);
    clearTimeout(safety);
    el.querySelectorAll('.gm-btn__label--out').forEach((o) => o.remove());
    const incoming: Node = typeof content === 'string' ? document.createTextNode(content) : content;

    const r = rectOf();
    const fromW = Math.round(r.width);
    height = Math.round(r.height) || height;
    const toW = Math.max(measureWidth(incoming), height); // never thinner than a circle

    // Immediate set (initial content, or a caller that wants no motion): no
    // crossfade clone and no width tween — just land at the final state.
    if (immediate) {
      label.replaceChildren(incoming);
      label.classList.remove('gm-btn__label--in');
      el.style.width = `${toW}px`;
      surface.regenerate(toW, height, radius());
      return Promise.resolve();
    }

    // Crossfade: clone the current label as the outgoing layer, swap in the new
    // content, then let the clone fade itself out and self-remove (idempotent,
    // so overlapping swaps can never leak a clone).
    const outgoing = label.cloneNode(true) as HTMLElement;
    // Hard-reset the classes: `label` still carries `--in` from the previous
    // swap, and a clone that inherits it would run the ENTER animation (fade
    // 0→1) instead of leaving — two labels fading in together is the ghost.
    outgoing.className = 'gm-btn__label gm-btn__label--out';
    el.appendChild(outgoing);
    label.replaceChildren(incoming);
    label.classList.remove('gm-btn__label--in');
    void label.offsetWidth; // one reflow paints both base states: restarts the enter
    // animation from its start, and lets the outgoing fade transition (not jump).
    label.classList.add('gm-btn__label--in'); // held invisible by its delay until the old clears
    outgoing.classList.add('is-gone'); // old lifts out + fades first (no rAF: works on hidden tabs)
    setTimeout(() => outgoing.remove(), 400);

    if (prefersReduced()) {
      el.style.width = `${toW}px`;
      surface.regenerate(toW, height, radius());
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const t0 = performance.now();
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        cancelAnimationFrame(raf);
        clearTimeout(safety);
        el.style.width = `${toW}px`;
        surface.setDisplScale(1);
        surface.regenerate(toW, height, radius()); // crisp settle
        resolve();
      };
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / duration);
        const w = fromW + (toW - fromW) * overshoot(k);
        el.style.width = `${w}px`;
        surface.setBox(w, height);
        // a refraction "kick" that peaks at the middle of the morph and settles
        surface.setDisplScale(1 + pulse * Math.sin(k * Math.PI));
        if (k < 1) raf = requestAnimationFrame(step);
        else finish();
      };
      raf = requestAnimationFrame(step);
      // rAF is paused on background tabs (IMPROVEMENTS invariant 8); force settle.
      safety = window.setTimeout(finish, duration + 120);
    });
  };

  return {
    el,
    setContent,
    reconfigure: (patch) => surface.reconfigure(patch),
    getOptions: () => surface.getOptions(),
    dispose() {
      cancelAnimationFrame(raf);
      clearTimeout(safety);
      surface.dispose();
      bg.remove();
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Glass dropdown — a menu panel that materializes open
// ─────────────────────────────────────────────────────────────────────────────

export interface GlassDropdownOptions extends Partial<GlassSurfaceParams> {
  trigger: HTMLElement; // the button that toggles the menu
  menu: HTMLElement; // the panel; its first `.gm-dd__bg` child is the refracted pane
  radius?: number; // panel corner radius (default 16)
  duration?: number; // open/close duration, ms (default 340)
  stagger?: number; // per-item entrance stagger, ms (default 26)
  onOpenChange?: (open: boolean) => void;
}

export interface GlassDropdown {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  reconfigure(patch: Partial<GlassSurfaceParams>): void;
  getOptions(): GlassSurfaceParams;
  dispose(): void;
}

/**
 * Wire a liquid-glass dropdown. `menu` is shown/hidden; on open the glass
 * refraction ramps from clear to full (Aave's `displScale`) while the panel
 * grows from the trigger and the items stagger in. Requires a `.gm-dd__bg` pane
 * inside `menu` (the refracted layer) and `.gm-dd__item` children for stagger.
 */
export function mountGlassDropdown(o: GlassDropdownOptions): GlassDropdown {
  const { trigger, menu } = o;
  const duration = o.duration ?? 340;
  const stagger = o.stagger ?? 26;
  const radius = o.radius ?? 16;

  const bg = menu.querySelector<HTMLElement>('.gm-dd__bg');
  if (!bg) throw new Error('mountGlassDropdown: menu needs a .gm-dd__bg pane');
  // The reveal grows an inner panel, not the menu itself — so the menu keeps its
  // drop-shadow, which fades in with opacity instead of being clipped away for the
  // whole open and popping in at the end. Auto-wrapped so existing markup needs no
  // change.
  let panel = menu.querySelector<HTMLElement>('.gm-dd__panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'gm-dd__panel';
    while (menu.firstChild) panel.appendChild(menu.firstChild);
    menu.appendChild(panel);
  }
  const clipEl = panel;
  // Reveal by animating the panel's height (it already has overflow:hidden), NOT
  // clip-path. The glass pane uses background-attachment:fixed to stay aligned
  // with the scene behind it, and a fixed background ESCAPES clip-path in Chromium
  // — so a clip-path reveal grows the tint + items top-down while the glass pane
  // paints at full size the whole time (the panel "pops" to full size, then fills
  // in). overflow:hidden clips by BOX SIZE, which does clip a fixed-background
  // pane, so growing max-height reveals the whole surface as one piece. `frac` is
  // openness 0..1; >=1 clears the cap so the panel sits at its natural height.
  const setReveal = (frac: number) => {
    clipEl.style.maxHeight = frac >= 1 ? '' : `${frac * mh}px`;
  };
  const items = () => Array.from(menu.querySelectorAll<HTMLElement>('.gm-dd__item'));

  // The surface is built lazily (a hidden menu has no measurable size), so keep
  // the resolved params here too — the Tuner reads/writes them before first open.
  const curParams: GlassSurfaceParams = {
    depth: o.depth ?? GLASS_SURFACE_DEFAULTS.depth,
    dome: o.dome ?? GLASS_SURFACE_DEFAULTS.dome,
    edge: o.edge ?? GLASS_SURFACE_DEFAULTS.edge,
    glow: o.glow ?? GLASS_SURFACE_DEFAULTS.glow,
    strength: o.strength ?? GLASS_SURFACE_DEFAULTS.strength,
    chroma: o.chroma ?? GLASS_SURFACE_DEFAULTS.chroma,
    blur: o.blur ?? GLASS_SURFACE_DEFAULTS.blur,
    spec: o.spec ?? GLASS_SURFACE_DEFAULTS.spec,
  };

  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  menu.setAttribute('role', menu.getAttribute('role') || 'menu');
  menu.hidden = true;

  let open = false;
  let raf = 0;
  let safety = 0;
  let surface: GlassSurface | null = null;
  let mw = 0;
  let mh = 0;

  const ensureSurface = () => {
    const r = menu.getBoundingClientRect();
    mw = Math.round(r.width);
    mh = Math.round(r.height);
    if (!surface) {
      surface = createGlassSurface({
        host: menu,
        target: bg,
        width: mw,
        height: mh,
        radius,
        active: true,
        ...curParams,
      });
    } else {
      surface.regenerate(mw, mh, radius);
    }
    surface.setDisplScale(0);
  };

  // Animate the panel between closed (0) and open (1). `opening` picks the curve:
  // opening springs (overshoot), closing eases out. Everything visual is derived
  // from one openness value `p` so the glass, the grow, and the items stay in
  // lockstep.
  const tween = (opening: boolean, after?: () => void) => {
    cancelAnimationFrame(raf);
    clearTimeout(safety);
    const list = items();
    // The panel grows via max-height (+ overflow:hidden), NOT `transform`: the
    // refracted pane uses a fixed-attachment backdrop clone (so it bends the scene
    // behind it), and a `transform` would re-anchor that fixed background to the
    // panel box, breaking the alignment mid-animation. A height cap leaves it
    // viewport-locked AND clips the fixed pane — which clip-path can't.
    const paint = (p: number, k: number) => {
      const pc = Math.max(0, Math.min(1, p));
      surface?.setDisplScale(Math.min(1.12, p)); // refraction materializes (Aave's displScale)
      setReveal(pc);
      menu.style.opacity = String(Math.min(1, p * 1.6));
      list.forEach((it, i) => {
        const d = (i * stagger) / duration; // per-item delay as a fraction of the run
        const ik = Math.max(0, Math.min(1, (k - d) / Math.max(0.0001, 1 - d)));
        const iv = opening ? ik : 1 - k;
        it.style.opacity = String(iv);
        it.style.transform = `translateY(${(1 - iv) * 7}px)`;
      });
    };
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      clearTimeout(safety);
      paint(opening ? 1 : 0, 1); // pin the exact end state
      after?.();
    };
    if (prefersReduced()) {
      setReveal(1);
      finish();
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / duration);
      const p = opening ? overshoot(k) : 1 - easeInOut(k);
      paint(p, k);
      if (k < 1) raf = requestAnimationFrame(step);
      else finish();
    };
    raf = requestAnimationFrame(step);
    // rAF is throttled/paused on background tabs (IMPROVEMENTS invariant 8), which
    // would strand the panel mid-open/close. A timer forces the end state anyway.
    safety = window.setTimeout(finish, duration + 120);
  };

  const doOpen = () => {
    if (open) return;
    open = true;
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    ensureSurface();
    // start collapsed (height 0, items down + faded)
    setReveal(0);
    menu.style.opacity = '0';
    items().forEach((it) => {
      it.style.opacity = '0';
      it.style.transform = 'translateY(7px)';
    });
    // Hold the reveal until the map has decoded. Otherwise the first frames paint
    // the panel FLAT (map not ready → neutral flood → no refraction) and the glass
    // pops in a beat late — the "opens as a plain translucent box, then fills in
    // with glass" jank. The panel is already collapsed + fully transparent above,
    // so nothing shows while we wait (about a frame on a cold first open, instant
    // after). aria/state already read open, so keyboard + outside-click still work.
    const revealOpen = () => {
      if (!open) return; // closed again before the map finished decoding
      tween(true, () => {
        surface?.setDisplScale(1);
        surface?.regenerate(mw, mh, radius); // crisp settle
        setReveal(1);
      });
    };
    const mapReady = surface?.whenReady();
    if (mapReady) mapReady.then(revealOpen);
    else revealOpen();
    o.onOpenChange?.(true);
  };

  const doClose = () => {
    if (!open) return;
    open = false;
    trigger.setAttribute('aria-expanded', 'false');
    tween(false, () => {
      menu.hidden = true;
      setReveal(1);
      o.onOpenChange?.(false);
    });
  };

  const onTriggerClick = (e: Event) => {
    e.preventDefault();
    if (open) doClose();
    else doOpen();
  };
  const onDocPointer = (e: Event) => {
    if (!open) return;
    const t = e.target as Node;
    if (!menu.contains(t) && !trigger.contains(t)) doClose();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      doClose();
      trigger.focus();
    }
  };

  trigger.addEventListener('click', onTriggerClick);
  document.addEventListener('pointerdown', onDocPointer);
  document.addEventListener('keydown', onKey);

  return {
    open: doOpen,
    close: doClose,
    toggle: () => (open ? doClose() : doOpen()),
    isOpen: () => open,
    reconfigure: (patch) => {
      Object.assign(curParams, patch);
      surface?.reconfigure(patch);
    },
    getOptions: () => surface?.getOptions() ?? { ...curParams },
    dispose() {
      cancelAnimationFrame(raf);
      clearTimeout(safety);
      trigger.removeEventListener('click', onTriggerClick);
      document.removeEventListener('pointerdown', onDocPointer);
      document.removeEventListener('keydown', onKey);
      surface?.dispose();
    },
  };
}
