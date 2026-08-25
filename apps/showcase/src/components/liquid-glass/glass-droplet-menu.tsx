'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Menu as BaseMenu } from '@base-ui/react/menu';
import {
  mountGlassGroup,
  traceGroupSilhouette,
  type GlassGroup,
  type GlassGroupParams,
  type GroupShape,
} from '@liquidglassjs/core';
import type { MapProfile } from '@liquidglassjs/core';
import { cn } from '@/lib/utils';
import '@liquidglassjs/core/css';

/**
 * Liquid-glass Droplet Menu — Base UI's Menu where the trigger pill and the open
 * panel are ONE glass surface. A single smooth-min displacement map (mountGlassGroup)
 * holds both shapes, so opening grows the panel out of the pill through a liquid
 * neck — Apple's droplet merge. By default the neck then PINCHES OFF: through the
 * last stretch of the open the smooth-min `blend` eases to zero, so the thread
 * thins and snaps while the panel is still settling, leaving a fully detached
 * panel at rest. Closing runs it backwards — the droplet reconnects, then slurps
 * back into the pill. Pass `attached` to keep the resting neck instead.
 *
 *   <GlassDropletMenu backdrop={pageBackground}>
 *     <GlassDropletMenuTrigger>Actions</GlassDropletMenuTrigger>
 *     <GlassDropletMenuContent>
 *       <GlassDropletMenuItem>Profile</GlassDropletMenuItem>
 *       <GlassDropletMenuSeparator />
 *       <GlassDropletMenuItem>Sign out</GlassDropletMenuItem>
 *     </GlassDropletMenuContent>
 *   </GlassDropletMenu>
 *
 * Unlike GlassDropdownMenu (glass as a skin on the popup), the glass props live on
 * the ROOT: the droplet is one surface spanning trigger and panel, so there is no
 * per-part glass to configure. Behavior (anchoring, roving focus, typeahead, ARIA)
 * is still entirely Base UI's.
 *
 * How it renders: a pane portalled to <body> spans the union of trigger and panel,
 * carries the group's filter, and is clipped to the fused silhouette (a path traced
 * from the same SDF that made the map — synchronous, so the silhouette, the
 * refraction, and the content move in the same frame), so the page between the
 * shapes stays untouched. Given a
 * `backdrop` the pane paints and refracts it (the library's viewport-locked clone
 * convention — align it with your page background); without one it falls back to a
 * droplet-shaped frost. The trigger and menu items are chrome ABOVE the pane and are
 * never filtered — the Safari-safe arrangement.
 */

type DropletParams = GlassGroupParams;

/** What the engine reads live: the glass params plus the resting-neck choice. */
type EngineParams = DropletParams & { attached: boolean };

const DROPLET_DEFAULTS: DropletParams = {
  blend: 28,
  strength: 16,
  chroma: 0.4,
  depth: 12,
  profile: 'erf',
  edge: 0.9,
  glow: 0.3,
  shade: 0.35,
  specularRotation: 45,
  blur: 0.4,
  spec: 0.7,
};

/** Page-coordinate rect (client rect + scroll), the space the pane is laid out in. */
interface PageRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const pageRectOf = (el: Element): PageRect => {
  const r = el.getBoundingClientRect();
  return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
};

const radiusOf = (el: Element, fallback: number): number => {
  const r = parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return Number.isFinite(r) && r > 0 ? r : fallback;
};

/** A measured rect as a group shape in pane coordinates, radius pre-clamped to a pill. */
const toShape = (r: PageRect, paneX: number, paneY: number, radius: number): GroupShape => ({
  x: r.x - paneX,
  y: r.y - paneY,
  w: r.w,
  h: r.h,
  r: Math.min(radius, Math.min(r.w, r.h) / 2),
});

const lerpShape = (a: GroupShape, b: GroupShape, t: number): GroupShape => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  w: a.w + (b.w - a.w) * t,
  h: a.h + (b.h - a.h) * t,
  r: a.r + (b.r - a.r) * t,
});

// Spring-tailed open curve — glass-morph's shape, but gentler: 0.7× the back
// coefficient (~5% overshoot vs ~13%) so the panel lands with a settle, not a
// bounce.
function overshoot(t: number): number {
  const c = 1.70158 * 0.7;
  const p = t - 1;
  return 1 + p * p * ((c + 1) * p + c);
}
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const reducedMotion = (): boolean =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

interface Engine {
  openTo(popup: HTMLElement): void;
  close(): void;
  reconfigure(): void;
  dispose(): void;
}

/**
 * The imperative half: owns the group, the pane box, the two shapes, and the
 * open/close animation. Lives outside React so an in-flight morph never fights a
 * re-render; `paramsRef` is read fresh so the Tuner's slider writes land live.
 */
function createEngine(
  trigger: HTMLElement,
  host: HTMLElement,
  bend: HTMLElement,
  backdropLayer: HTMLElement | null,
  paramsRef: React.RefObject<EngineParams>,
  duration: number,
): Engine {
  let disposed = false;
  let raf = 0;
  let safety = 0;
  let revealed = false;
  let phase: 'closed' | 'opening' | 'open' | 'closing' = 'closed';
  // Everything below is in PANE coordinates except the pane box itself.
  let paneX = 0;
  let paneY = 0;
  let paneW = 1;
  let paneH = 1;
  let shapes: GroupShape[] = [];
  let panel: GroupShape | null = null; // the animated shape, tracked for retargeting
  let panelPopup: HTMLElement | null = null;
  let lastClip = '';

  const params = () => paramsRef.current;
  const glassParams = (): DropletParams => {
    const { attached: _attached, ...rest } = paramsRef.current;
    return rest;
  };

  // The LIVE smooth-min k. Steady states pin it — full `blend` closed (and at rest
  // when `attached`), zero at detached rest — and the animations sweep it: easing
  // it to zero through the tail of the open is the pinch-off (the neck thins and
  // snaps while the panel is still settling), ramping it back up first thing on
  // close is the droplet reconnecting before it retracts. The map regenerates per
  // frame during a morph anyway, so sweeping the fuse there is free.
  let fuse = paramsRef.current.blend;
  const restFuse = () => (params().attached ? params().blend : 0);
  const setFuse = (f: number) => {
    const next = Math.round(f * 2) / 2; // half-px, the map's own key precision
    if (next === fuse) return;
    fuse = next;
    group.reconfigure({ blend: next });
  };

  // Room the glass needs beyond the shapes: half the fuse band, the peak
  // displacement, and a little slack for the open spring's overshoot.
  const apron = () => Math.ceil(params().blend * 0.5 + params().strength + 12);

  const setPaneBox = (rects: PageRect[], extra = 0) => {
    const a = apron() + extra;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const r of rects) {
      x0 = Math.min(x0, r.x);
      y0 = Math.min(y0, r.y);
      x1 = Math.max(x1, r.x + r.w);
      y1 = Math.max(y1, r.y + r.h);
    }
    const oldX = paneX;
    const oldY = paneY;
    paneX = Math.floor(x0 - a);
    paneY = Math.floor(y0 - a);
    paneW = Math.ceil(x1 - x0 + 2 * a);
    paneH = Math.ceil(y1 - y0 + 2 * a);
    host.style.top = `${paneY}px`;
    host.style.left = `${paneX}px`;
    host.style.width = `${paneW}px`;
    host.style.height = `${paneH}px`;
    if (revealed && (paneX !== oldX || paneY !== oldY)) {
      // The box just moved, but the map, clip, and background alignment on
      // screen are still in the OLD box's local coordinates — left alone they
      // all render at the new origin, i.e. the whole pill jumps to the pane's
      // top-left until the new pair commits. Freeze the old rendering in place
      // with a compensating translate (screen-space no-op) and hold the
      // backdrop's old alignment; applyClip's commit releases both atomically
      // with the new-coordinates map + clip.
      bend.style.transform = `translate(${oldX - paneX}px, ${oldY - paneY}px)`;
      pendingShift = true;
    } else {
      syncBackdrop();
    }
  };

  // Align the backdrop layer with the viewport by hand — the library's clone
  // convention, minus `background-attachment: fixed`: Chromium does not clip a
  // fixed-attachment background through clip-path (the bug glass-morph's
  // height-reveal dodges), and the clip is what shapes this pane. Gradients
  // stretch to the viewport box exactly as fixed/cover paints them.
  const syncBackdrop = () => {
    if (!backdropLayer) return;
    backdropLayer.style.backgroundSize = `${window.innerWidth}px ${window.innerHeight}px`;
    backdropLayer.style.backgroundPosition = `${window.scrollX - paneX}px ${window.scrollY - paneY}px`;
  };

  const triggerShape = (): GroupShape => {
    const t = pageRectOf(trigger);
    return toShape(t, paneX, paneY, radiusOf(trigger, t.h / 2));
  };

  // The clip is the same smin silhouette the map bends, traced NOW (while the
  // shapes hold this frame's values) but WRITTEN only when this frame's map
  // commits. The map's commit is decode-gated (img.decode resolves in a later
  // task, even in Chromium), so a clip written synchronously leads the
  // refraction by a frame — frame-by-frame that's ghost rims of the previous
  // shape inside the new silhouette. Chaining the write onto the same
  // whenReady() promise the commit rides (registered after it, so it runs
  // after it in the same task) keeps clip and map a consistent pair; the
  // generation guard drops a superseded frame's clip entirely, so a skipped
  // map never gets the wrong silhouette either.
  let clipGen = 0;
  let pendingShift = false;
  const applyClip = () => {
    const gen = ++clipGen;
    const d = traceGroupSilhouette({ width: paneW, height: paneH, shapes, blend: fuse, cell: 2 });
    void group.whenReady().then(() => {
      if (disposed || gen !== clipGen) return;
      if (pendingShift) {
        // The pane box moved this gesture: release the freeze-in-place
        // compensation in the same task the new-coordinates map committed in.
        pendingShift = false;
        bend.style.transform = '';
        syncBackdrop();
      }
      if (d === lastClip) return;
      lastClip = d;
      bend.style.clipPath = `path('${d}')`;
      bend.style.setProperty('-webkit-clip-path', `path('${d}')`);
    });
  };

  const group: GlassGroup = mountGlassGroup({
    target: bend,
    host,
    items: () => shapes,
    ...glassParams(),
    // Rounds off the crease an exact SDF's medial axis folds into every corner
    // of the refraction — grid-like backdrops made it read as a dog-eared rim.
    smoothNormals: 3,
  });

  // The pane starts invisible; show it only once the first map can paint, so no
  // frame ever shows the flat unrefracted pane. (The clip needs no such gate —
  // a path commits synchronously.)
  const reveal = () => {
    void group.whenReady().then(() => {
      if (disposed || revealed) return;
      revealed = true;
      host.style.opacity = '';
    });
  };

  const syncClosed = () => {
    phase = 'closed';
    panel = null;
    panelPopup = null;
    setFuse(params().blend);
    // Keep the current pane box when it still contains the pill: a box change
    // moves the local coordinate frame, which is a whole shifted-pair commit
    // (see setPaneBox) — pointless churn after a close, whose union box always
    // contains the pill. Re-box only when the pill outgrew it (first mount,
    // trigger moved). A resting pane larger than the pill costs nothing: the
    // map is neutral outside the shapes and the filter output is cached.
    const t = pageRectOf(trigger);
    const a = apron();
    const fits =
      t.x - a >= paneX &&
      t.y - a >= paneY &&
      t.x + t.w + a <= paneX + paneW &&
      t.y + t.h + a <= paneY + paneH;
    if (!fits) setPaneBox([t]);
    shapes = [triggerShape()];
    group.flush();
    applyClip();
    if (!revealed) reveal();
  };

  const stopAnim = () => {
    cancelAnimationFrame(raf);
    clearTimeout(safety);
    raf = 0;
  };

  // rAF with a timer fallback: on hidden/occluded tabs rAF never fires, and a
  // measurement step that waits on it would strand the open before the animate()
  // safety net even gets a chance to exist.
  const schedule = (fn: () => void, ms = 48) => {
    let fired = false;
    const once = () => {
      if (fired || disposed) return;
      fired = true;
      fn();
    };
    raf = requestAnimationFrame(once);
    safety = window.setTimeout(once, ms);
  };

  const animate = (
    ms: number,
    ease: (t: number) => number,
    paint: (e: number, k: number) => void,
    done: () => void,
  ) => {
    stopAnim();
    // The clock starts on the FIRST PAINTED frame, not at call time: the click
    // has already spent 2–3 frames on scheduling and popup measurement, and an
    // ease-out curve billed for that time opens its first visible frame ~35%
    // grown — the panel pops instead of growing out of the pill.
    let t0 = 0;
    let finished = false;
    const finish = () => {
      if (finished || disposed) return;
      finished = true;
      stopAnim();
      done();
    };
    const step = (now: number) => {
      if (!t0) t0 = now;
      const k = Math.min(1, (now - t0) / ms);
      paint(ease(k), k);
      if (k < 1) raf = requestAnimationFrame(step);
      else finish();
    };
    raf = requestAnimationFrame(step);
    // rAF stalls on hidden/occluded tabs; land the end state regardless. Padded
    // for the first-paint clock start.
    safety = window.setTimeout(finish, ms + 250);
  };

  // The closed resting state IS the trigger's glass: pill-only pane, revealed
  // once the first map + mask can paint.
  syncClosed();

  // One frame of the merge, all in lockstep: scale first, then shapes → the
  // synchronous map re-encode (flush, not the rAF-coalesced update) → the clip.
  // ORDER IS LOAD-BEARING: setDisplScale (like setFuse) renames the live filter
  // through the same counter the pending map commit uses as its generation
  // guard, so a bump AFTER flush supersedes the map that flush just baked —
  // every frame — and the filter keeps serving its last committed map. Bumps
  // first, bake last. The trigger shape is measured once per gesture and passed
  // in — it does not move mid-morph.
  const paintMerge = (T: GroupShape, cur: GroupShape, kick: number) => {
    panel = cur;
    shapes = [T, cur];
    group.setDisplScale(1 + kick);
    group.flush();
    applyClip();
  };

  const settleOpen = (T: GroupShape, to: GroupShape, popup: HTMLElement) => {
    phase = 'open';
    setFuse(restFuse());
    paintMerge(T, to, 0); // ends at displScale 1; nothing may bump after this flush
    popup.style.opacity = '1';
    popup.style.transform = '';
  };

  // Re-derive the whole open geometry from live rects (viewport resized, page
  // reflowed). Not used mid-animation — the morph owns those frames.
  const refreshOpen = () => {
    const popup = panelPopup;
    if (!popup) return;
    const t = pageRectOf(trigger);
    const p = pageRectOf(popup);
    setPaneBox([t, p]);
    const T = toShape(t, paneX, paneY, radiusOf(trigger, t.h / 2));
    const to = toShape(p, paneX, paneY, radiusOf(popup, 16));
    panel = to;
    shapes = [T, to];
    group.flush();
    applyClip();
  };

  const onScroll = () => syncBackdrop();
  const onResize = () => {
    if (phase === 'closed') syncClosed();
    else if (phase === 'open') refreshOpen();
    else syncBackdrop();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);

  // The fuse over the open run. It starts at ZERO on a fresh open (f0=0): the
  // panel begins as a copy of the pill, and the quadratic smin of two
  // COINCIDENT shapes deepens the field by k/4 — a full-blend start renders the
  // pill ~blend/4 px fatter for a frame. The fuse ramps in as the shapes
  // actually pull apart, then — unless `attached` — eases back to zero across
  // k 0.45…0.85 so the neck snaps while the spring tail is still settling.
  // easeInOut crosses the bridge threshold steeply, so the breaking thread
  // lives for a frame or two, not a lingering 8-bit shimmer.
  const openFuse = (k: number, f0: number): number =>
    (f0 + (params().blend - f0) * easeInOut(clamp01(k / 0.22))) *
    (params().attached ? 1 : 1 - easeInOut(clamp01((k - 0.45) / 0.4)));

  return {
    openTo(popup) {
      stopAnim();
      panelPopup = popup;
      // Base UI positions the popup in its own effects; measure a frame later, and
      // hold the content invisible until the droplet starts carrying it.
      popup.style.opacity = '0';
      let tries = 0;
      const start = () => {
        if (disposed || panelPopup !== popup) return;
        const p = pageRectOf(popup);
        if ((p.w < 2 || p.h < 2) && tries++ < 10) {
          schedule(start);
          return;
        }
        const t = pageRectOf(trigger);
        const slack = Math.ceil(
          0.18 *
            Math.max(
              Math.abs(p.x - t.x) + Math.abs(p.w - t.w),
              Math.abs(p.y - t.y) + Math.abs(p.h - t.h),
            ),
        );
        setPaneBox([t, p], slack);
        const T = triggerShape();
        const to = toShape(p, paneX, paneY, radiusOf(popup, 16));
        // Grow from wherever the droplet is (mid-close retarget) or from the
        // pill; the fuse likewise continues from its live value mid-flight and
        // starts at zero from rest (see openFuse).
        const from = panel ?? { ...T };
        const fuseFrom = panel ? fuse : 0;
        if (reducedMotion()) {
          settleOpen(T, to, popup);
          if (!revealed) reveal();
          return;
        }
        phase = 'opening';
        animate(
          duration,
          overshoot,
          (e, k) => {
            setFuse(openFuse(k, fuseFrom));
            paintMerge(T, lerpShape(from, to, e), 0.14 * Math.sin(k * Math.PI));
            const cf = clamp01((k - 0.3) / 0.55);
            popup.style.opacity = String(cf);
            popup.style.transform = `translateY(${(1 - cf) * 5}px)`;
          },
          () => settleOpen(T, to, popup),
        );
      };
      schedule(start);
    },

    close() {
      if (phase === 'closed' || phase === 'closing') return;
      stopAnim();
      panelPopup = null;
      const from = panel;
      if (!from || reducedMotion()) {
        syncClosed();
        return;
      }
      phase = 'closing';
      const T = triggerShape();
      // The close deliberately does NOT merge. Any smin between the incoming
      // panel and the pill deforms the PILL — neck shoulders on its rim, then
      // the overlap inflation — and a control that changes shape because
      // something else moved reads as flicker. So the fuse dissolves to zero in
      // the first fifth (melting a resting neck if `attached`, or whatever a
      // mid-open retarget left) and the panel retracts as a PLAIN union: it
      // slides in behind the pill, the pill's contour never moves, and the
      // final coincident union is exactly the pill, so syncClosed's swap to one
      // shape changes nothing on screen. No displacement kick here either —
      // that modulates the pill's refraction depth, the same "breathing".
      const fuse0 = fuse;
      animate(
        Math.round(duration * 0.7),
        easeInOut,
        (e, k) => {
          setFuse(fuse0 * (1 - easeInOut(clamp01(k / 0.2))));
          paintMerge(T, lerpShape(from, T, e), 0);
        },
        syncClosed,
      );
    },

    // Slider writes: push every live param into the group, and re-cut the clip —
    // `blend` moves the silhouette. Steady phases re-derive the fuse from the new
    // params (an animation in flight keeps its own sweep).
    reconfigure() {
      if (phase === 'open') fuse = restFuse();
      else if (phase === 'closed') fuse = params().blend;
      group.reconfigure({ ...glassParams(), blend: fuse });
      lastClip = '';
      applyClip();
    },

    dispose() {
      disposed = true;
      stopAnim();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      group.dispose();
    },
  };
}

interface DropletCtxValue {
  setTriggerEl(el: HTMLElement | null): void;
  setPopupEl(el: HTMLElement | null): void;
}

const DropletCtx = React.createContext<DropletCtxValue | null>(null);

const useDropletCtx = (who: string): DropletCtxValue => {
  const ctx = React.useContext(DropletCtx);
  if (!ctx) throw new Error(`${who} must be used inside <GlassDropletMenu>`);
  return ctx;
};

export interface GlassDropletMenuProps
  extends React.ComponentProps<typeof BaseMenu.Root>, Partial<DropletParams> {
  /**
   * CSS background (an image — gradient or url, not a bare colour) the droplet
   * paints and refracts, using the library's viewport-locked clone convention —
   * hand it your page's own background so the pane blends in. Omitted, the droplet
   * falls back to a silhouette-shaped frost (blur, no refraction off Chromium-only
   * paths — same trade as the other frost shells, but still droplet-shaped).
   */
  backdrop?: string;
  /** Open morph length, ms (close runs at 70%). Default 430. */
  duration?: number;
  /**
   * Keep the resting menu joined to its trigger by the smooth-min neck. Default
   * false: the neck pinches off through the tail of the open and the panel
   * settles fully detached (it re-bridges on close).
   */
  attached?: boolean;
  profile?: MapProfile;
}

function GlassDropletMenu({
  children,
  backdrop,
  duration = 430,
  attached = false,
  blend = DROPLET_DEFAULTS.blend,
  strength = DROPLET_DEFAULTS.strength,
  chroma = DROPLET_DEFAULTS.chroma,
  depth = DROPLET_DEFAULTS.depth,
  profile = DROPLET_DEFAULTS.profile,
  edge = DROPLET_DEFAULTS.edge,
  glow = DROPLET_DEFAULTS.glow,
  shade = DROPLET_DEFAULTS.shade,
  specularRotation = DROPLET_DEFAULTS.specularRotation,
  blur = DROPLET_DEFAULTS.blur,
  spec = DROPLET_DEFAULTS.spec,
  onOpenChange,
  ...rootProps
}: GlassDropletMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [triggerEl, setTriggerEl] = React.useState<HTMLElement | null>(null);
  const [popupEl, setPopupEl] = React.useState<HTMLElement | null>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const hostRef = React.useRef<HTMLDivElement>(null);
  const bendRef = React.useRef<HTMLDivElement>(null);
  const backdropLayerRef = React.useRef<HTMLDivElement>(null);
  const engineRef = React.useRef<Engine | null>(null);

  const params: EngineParams = {
    attached,
    blend,
    strength,
    chroma,
    depth,
    profile,
    edge,
    glow,
    shade,
    specularRotation,
    blur,
    spec,
  };
  const paramsRef = React.useRef(params);
  paramsRef.current = params;

  // Mount the engine once trigger + pane exist; remount only for structural
  // changes (a new trigger node, a different backdrop) — params flow live.
  React.useEffect(() => {
    const host = hostRef.current;
    const bend = bendRef.current;
    if (!triggerEl || !host || !bend) return;
    const engine = createEngine(
      triggerEl,
      host,
      bend,
      backdropLayerRef.current,
      paramsRef,
      duration,
    );
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- engine reads params via ref
  }, [triggerEl, mounted, backdrop, duration]);

  React.useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (open && popupEl) engine.openTo(popupEl);
    else if (!open) engine.close();
  }, [open, popupEl, triggerEl, mounted, backdrop, duration]);

  const paramKey = Object.values(params).join();
  React.useEffect(() => {
    engineRef.current?.reconfigure();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- paramKey captures every param
  }, [paramKey]);

  const ctx = React.useMemo<DropletCtxValue>(() => ({ setTriggerEl, setPopupEl }), []);

  return (
    <DropletCtx.Provider value={ctx}>
      <BaseMenu.Root
        {...rootProps}
        onOpenChange={(next, details) => {
          setOpen(next);
          onOpenChange?.(next, details);
        }}
      >
        {children}
      </BaseMenu.Root>
      {mounted &&
        createPortal(
          // The droplet pane: spans trigger ∪ panel in page coordinates, carries the
          // group's filter on `bend`, and is masked to the fused silhouette so the
          // page between the shapes stays visible. z-40 floats it over page content;
          // the trigger label (z-[41]) and the popup (z-50) ride above it.
          <div
            ref={hostRef}
            aria-hidden
            style={{ position: 'absolute', zIndex: 40, pointerEvents: 'none', opacity: 0 }}
          >
            <div
              ref={bendRef}
              style={{
                position: 'absolute',
                inset: 0,
                ...(backdrop
                  ? {}
                  : {
                      background: 'var(--glass-frost-bg, rgb(255 255 255 / 14%))',
                      backdropFilter: 'blur(14px) saturate(1.2)',
                      WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
                    }),
              }}
            >
              {backdrop && (
                <>
                  {/* The refracted picture: the library's viewport-locked backdrop
                      clone. No background-attachment: fixed — Chromium won't clip a
                      fixed background through the droplet clip-path, so the engine
                      viewport-aligns size/position by hand (syncBackdrop). */}
                  <div
                    ref={backdropLayerRef}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: 'var(--glass-paper, #fff)',
                      backgroundImage: backdrop,
                      backgroundRepeat: 'no-repeat',
                    }}
                  />
                  {/* A whisper of frost over the picture so item text stays legible. */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'var(--glass-droplet-wash, rgb(255 255 255 / 8%))',
                    }}
                  />
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </DropletCtx.Provider>
  );
}

function GlassDropletMenuTrigger({
  className,
  ...props
}: React.ComponentProps<typeof BaseMenu.Trigger>) {
  const ctx = useDropletCtx('GlassDropletMenuTrigger');
  return (
    <BaseMenu.Trigger
      ref={ctx.setTriggerEl}
      className={cn(
        // No background of its own: the droplet pane under it IS the pill. z-[41]
        // lifts the label over the pane (which sits at z-40 in a body portal).
        'relative z-[41] rounded-full px-5 py-2.5 text-sm font-medium text-white outline-none select-none',
        'focus-visible:ring-2 focus-visible:ring-white/50',
        className,
      )}
      {...props}
    />
  );
}

function GlassDropletMenuContent({
  className,
  children,
  sideOffset = 10,
  ...props
}: React.ComponentProps<typeof BaseMenu.Popup> & { sideOffset?: number }) {
  const ctx = useDropletCtx('GlassDropletMenuContent');
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner sideOffset={sideOffset} className="z-50 outline-none">
        {/* Transparent popup: its surface is the droplet pane below. It mounts at
            opacity 0 and the engine fades it in as the droplet grows to carry it —
            so no shadow/frost classes here, the glass rim is the edge. */}
        <BaseMenu.Popup
          ref={ctx.setPopupEl}
          style={{ opacity: 0 }}
          className={cn('relative min-w-44 rounded-2xl p-1.5 outline-none', className)}
          {...props}
        >
          <div className="relative z-10">{children}</div>
        </BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
}

function GlassDropletMenuItem({ className, ...props }: React.ComponentProps<typeof BaseMenu.Item>) {
  return (
    <BaseMenu.Item
      className={cn(
        'relative flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none select-none',
        'data-[highlighted]:bg-white/15 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

function GlassDropletMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof BaseMenu.Separator>) {
  return <BaseMenu.Separator className={cn('mx-1 my-1 h-px bg-white/15', className)} {...props} />;
}

export {
  GlassDropletMenu,
  GlassDropletMenuTrigger,
  GlassDropletMenuContent,
  GlassDropletMenuItem,
  GlassDropletMenuSeparator,
};
