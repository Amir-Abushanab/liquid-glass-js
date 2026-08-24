// Cubic-bézier easing that allows overshoot (control-point y > 1), for the
// switch's snap (Aave: ease [.22, 1.15, .36, 1.06], .32s).
//
// (The old `attachGlassDynamics` press/velocity-squish springs were removed
// during package extraction — they were unused. History lives in git.)

/**
 * Live read of `prefers-reduced-motion: reduce` — per call, so an OS toggle
 * takes effect without a reload. Apple's glass semantics for the setting:
 * reduced motion "disables any elastic properties"; state still changes, it
 * just stops bouncing there.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** A running scalar spring. All methods are safe after stop(). */
export interface SpringHandle {
  /** Retarget; wakes the loop if it had settled. */
  set(target: number): void;
  /** Jump straight to a value with no animation — the reduced-motion path. */
  snap(value: number): void;
  /** Current animated value. */
  get(): number;
  /** Cancel the loop (dispose). */
  stop(): void;
}

/**
 * A scalar spring for driving cheap per-frame filter attributes (the lens's
 * press boost, a drag chase) — semi-implicit Euler with the timestep clamped to
 * 20 ms substeps. The clamp is load-bearing: spring force grows with distance,
 * so integrating one dropped-to-15fps frame in a single step overshoots
 * further than it started and the error compounds frame over frame; a bad
 * frame integrated as several small ones stays stable. The rAF loop sleeps
 * whenever the spring settles, so an idle spring costs nothing.
 */
export function createSpring(
  initial: number,
  onUpdate: (value: number) => void,
  opts: { stiffness?: number; damping?: number } = {},
): SpringHandle {
  const k = opts.stiffness ?? 400;
  const c = opts.damping ?? 26;
  const MAX_STEP = 0.02;
  let value = initial;
  let target = initial;
  let vel = 0;
  let raf = 0;
  let last = 0;
  const settled = () => Math.abs(value - target) < 0.001 && Math.abs(vel) < 0.001;
  const frame = (now: number) => {
    raf = 0;
    let dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    while (dt > 0) {
      const h = Math.min(dt, MAX_STEP);
      dt -= h;
      vel += (target - value) * k * h;
      vel *= Math.exp(-c * h);
      value += vel * h;
    }
    if (settled()) {
      value = target;
      vel = 0;
      onUpdate(value);
      return;
    }
    onUpdate(value);
    raf = requestAnimationFrame(frame);
  };
  const wake = () => {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const snap = (v: number) => {
    target = v;
    value = v;
    vel = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    onUpdate(v);
  };
  return {
    set(t) {
      if (t === target) return;
      // Reduced motion de-elasticizes: the state change lands, the bounce doesn't.
      if (prefersReducedMotion()) {
        snap(t);
        return;
      }
      target = t;
      wake();
    },
    snap,
    get: () => value,
    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}

export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const A = (a: number, b: number) => 1 - 3 * b + 3 * a;
  const B = (a: number, b: number) => 3 * b - 6 * a;
  const C = (a: number) => 3 * a;
  const calc = (t: number, a: number, b: number) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
  const slope = (t: number, a: number, b: number) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
  const tForX = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const s = slope(t, x1, x2);
      if (s === 0) break;
      t -= (calc(t, x1, x2) - x) / s;
    }
    return t;
  };
  return (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : calc(tForX(x), y1, y2));
}
