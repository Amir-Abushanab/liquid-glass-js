// Easing a refraction param from one value to another — hover in, hover out, press,
// release — without handing anyone a footgun.
//
// The library ships no animation *presets*: curves and timings are the app's, and
// every consumer wants different numbers. What only the library knows is which params
// survive being written every frame. `strength`, `chroma`, `blur` (and `spec`, where
// the renderer has one) land on a filter attribute and cost about 0.01ms a call.
// Everything else is an input to the displacement map, so each change re-encodes a PNG
// — around 1.8ms on a lens, a third of a 60fps frame. A tween that didn't know the
// difference would let `glassTween(g).to({ dome: 20 })` quietly drop half the frames.
//
// So this tweens the cheap ones and applies the rest once, up front. The shape snaps
// and the refraction eases into it, which is the right way round anyway: a bevel
// morphing mid-hover reads as a glitch, a deepening bend reads as glass.

import { cubicBezier, prefersReducedMotion } from './dynamics';

/** Params that are a filter attribute rather than an input to the map. */
const LIVE = new Set(['strength', 'chroma', 'blur', 'spec']);

/** Aave's snap: a little overshoot, settles quickly. */
const DEFAULT_EASING = cubicBezier(0.22, 1, 0.36, 1);
const DEFAULT_DURATION = 260;

/** Anything with the standard reconfigure/getOptions pair — every renderer here. */
export interface GlassTweenTarget {
  reconfigure(patch: Record<string, number>): void;
  getOptions(): Record<string, number>;
}

export interface GlassTweenOptions {
  /** ms; default 260. */
  duration?: number;
  /** progress 0–1 → eased 0–1; default a soft overshoot. See `cubicBezier`. */
  easing?: (t: number) => number;
}

export interface GlassTween {
  /**
   * Ease to `params` from wherever the glass is right now. Calling it again
   * mid-flight retargets from the current value rather than snapping back to the
   * start, so hovering in and out faster than the duration stays continuous.
   */
  to(params: Record<string, number>, opts?: GlassTweenOptions): void;
  /** Stop where it is. The instance keeps whatever values it had reached. */
  stop(): void;
}

/**
 * Tween a glass instance's refraction params.
 *
 * ```js
 * const glass = mountGlassText({ target: el, host: el, strength: 4 });
 * const tween = glassTween(glass);
 * el.addEventListener('pointerenter', () => tween.to({ strength: 12.5 }));
 * el.addEventListener('pointerleave', () => tween.to({ strength: 4 }));
 * ```
 *
 * Honours `prefers-reduced-motion: reduce` by jumping straight to the target — read
 * per call, so toggling the OS setting takes effect without a reload.
 */
export function glassTween(target: GlassTweenTarget, base: GlassTweenOptions = {}): GlassTween {
  let raf = 0;
  let from: Record<string, number> = {};
  let to: Record<string, number> = {};
  let t0 = 0;
  let dur = 0;
  let ease: (t: number) => number = DEFAULT_EASING;

  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const frame = (now: number) => {
    raf = 0;
    const k = ease(Math.min(1, (now - t0) / dur));
    const patch: Record<string, number> = {};
    for (const key in to) patch[key] = from[key] + (to[key] - from[key]) * k;
    target.reconfigure(patch);
    if (now - t0 < dur) raf = requestAnimationFrame(frame);
  };

  return {
    to(params, opts) {
      stop();
      const cur = target.getOptions();
      // Map params are applied once, now — see the note at the top of the file.
      const snap: Record<string, number> = {};
      from = {};
      to = {};
      for (const key in params) {
        const v = params[key];
        if (typeof v !== 'number' || Number.isNaN(v)) continue;
        if (LIVE.has(key) && typeof cur[key] === 'number') {
          from[key] = cur[key];
          to[key] = v;
        } else {
          snap[key] = v;
        }
      }
      dur = opts?.duration ?? base.duration ?? DEFAULT_DURATION;
      ease = opts?.easing ?? base.easing ?? DEFAULT_EASING;
      const keys = Object.keys(to);
      if (Object.keys(snap).length) target.reconfigure(snap);
      if (!keys.length) return;
      if (!(dur > 0) || prefersReducedMotion()) {
        target.reconfigure(to);
        return;
      }
      t0 = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop,
  };
}
