// Interactive Glass QR — a vanilla port of Aave's React component
// (bundle fc9f28cb, components U + O). Wires the four pieces together:
//   geometry (real qrcode) → renderer (procedural WebGL) → painting (ripple)
//   → lens (animated displacement). Plus the interactions: a click fires a
//   refraction bloom + colour ripple + 360° logo spin + eye press; hover
//   3D-tilts the card and trails a glow across the modules.

import { buildQRGeometry } from './geometry';
import { QRGlassRenderer } from './renderer';
import { PaintingTexture, EC_RADIUS } from './painting';
import { hexToRgb, nextColor } from '@liquidglassjs/core';
import { LensGenerator } from './lens';
import { injectStyles } from './styles';
import { resolveLogo } from './logo';

export interface GlassQROptions {
  /** The encoded payload. Required — there is deliberately no default URL. */
  value: string;
  size?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  dotColor?: string;
  backgroundColor?: string;
  /**
   * The centre mark. Defaults to the built-in glass mark; `false` renders no
   * logo (and, unless `reserveCenter` says otherwise, encodes the middle too).
   * Pass a `Node` rather than a markup string under Trusted Types.
   */
  logo?: string | Node | false;
  /**
   * Punch a logo-sized hole in the encoded modules. Defaults to whether a logo
   * is actually being rendered — set it explicitly only for the rare case of a
   * hole with no mark. Reserving the centre costs error-correction budget, so
   * don't reserve it for a logo you aren't drawing.
   */
  reserveCenter?: boolean;
  /** @deprecated Renamed to `reserveCenter`, which now also tracks `logo`. */
  image?: boolean;
  /** Nonce for the injected <style>, for a `style-src 'nonce-…'` CSP. */
  nonce?: string;
  /** Set false when importing `@liquidglassjs/qr/css` yourself. Default true. */
  styles?: boolean;
  // refraction
  scaleX?: number;
  scaleY?: number;
  chromaAmount?: number;
  eyeRefractionScale?: number;
  // animation
  lensDuration?: number;
  lensDepth?: number;
  colorSplash?: number; // ms-ish; splashSpeed = 3000 / colorSplash
  ringStart?: number;
  ringEnd?: number;
}

// The subset of options the Glass Tuner can change at runtime (refraction + bloom).
export type GlassQRParams = Required<
  Pick<
    GlassQROptions,
    | 'scaleX'
    | 'scaleY'
    | 'chromaAmount'
    | 'eyeRefractionScale'
    | 'lensDepth'
    | 'lensDuration'
    | 'colorSplash'
    | 'ringStart'
    | 'ringEnd'
  >
>;
export interface GlassQRHandle {
  /** Callable for backwards compatibility — prefer the named `.dispose()`. */
  (): void;
  /** Tear down: cancels frames, drops listeners, frees GL, removes the DOM. */
  dispose(): void;
  reconfigure(patch: Partial<GlassQRParams>): void;
}

// ── easing + spring helpers ───────────────────────────────────────────────

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
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

class Spring {
  value: number;
  velocity = 0;
  target: number;
  constructor(
    value: number,
    private stiffness: number,
    private damping: number,
    private mass: number,
  ) {
    this.value = value;
    this.target = value;
  }
  set(target: number) {
    this.target = target;
  }
  step(dtSec: number) {
    let remaining = Math.min(dtSec, 0.064);
    const h = 0.004;
    while (remaining > 0) {
      const step = Math.min(h, remaining);
      const f = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
      this.velocity += (f / this.mass) * step;
      this.value += this.velocity * step;
      remaining -= step;
    }
  }
  get settled() {
    return Math.abs(this.value - this.target) < 0.01 && Math.abs(this.velocity) < 0.01;
  }
}

interface LensLayer {
  w: number;
  h: number;
  tween: { start: number; dur: number; from: number; to: number } | null;
  gen: LensGenerator;
}

/**
 * Mount an interactive Glass QR into `container`.
 *
 * Requires WebGL2 and THROWS where it isn't available (Brave's fingerprinting
 * shields block it, among others) — gate the call on {@link isGlassQRSupported}
 * and keep a plain QR as the fallback. A failed mount unwinds whatever it built,
 * so a caught throw leaves no orphaned DOM in `container`.
 */
export function mountGlassQR(container: HTMLElement, opts: GlassQROptions): GlassQRHandle {
  if (opts.styles !== false) injectStyles(opts.nonce);

  const value = opts.value;
  const size = opts.size ?? 300;
  const ec = opts.errorCorrectionLevel ?? 'Q';
  const dotColor = opts.dotColor ?? 'var(--ink)';
  const backgroundColor = opts.backgroundColor ?? 'var(--paper)';
  const logoNode = resolveLogo(opts.logo);
  // Reserving the centre spends error-correction budget, so it follows the logo
  // unless asked otherwise. `image` is the old name for the same switch.
  const reserveCenter = opts.reserveCenter ?? opts.image ?? logoNode !== null;
  let scaleX = opts.scaleX ?? 0.08; // mutable — the Glass Tuner reconfigures these live
  let scaleY = opts.scaleY ?? 0.08;
  let chromaAmount = opts.chromaAmount ?? 1;
  const eyeRefractionScale = opts.eyeRefractionScale ?? 0.16;
  let lensDuration = opts.lensDuration ?? 6000;
  let lensDepth = opts.lensDepth ?? 30;
  const colorSplash = opts.colorSplash ?? 300;
  const ringStart = opts.ringStart ?? 0.15;
  const ringEnd = opts.ringEnd ?? 0.9;

  const S = size; // the "/300" constants in Aave are the QR size
  const HALF_SIZE = 0.54 * S; // Aave: 162 at size 300
  const SIZE_TO = 2.2;
  const ease = cubicBezier(0.22, 1, 0.36, 1);

  // ── DOM ──
  const displayPx = size;
  const root = document.createElement('div');
  root.className = 'ps-qr';
  const tilt = document.createElement('div');
  tilt.className = 'ps-qr__tilt';
  const stage = document.createElement('div');
  stage.className = 'ps-qr__stage';
  const box = document.createElement('div');
  box.className = 'ps-qr__box';
  box.style.width = `${displayPx}px`;
  box.style.height = `${displayPx}px`;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.className = 'ps-qr__color';
  const qrCanvas = document.createElement('canvas');
  qrCanvas.className = 'ps-qr__qr';
  // `logo: false` drops the button entirely — no mark, and nothing to click.
  const logo = logoNode && document.createElement('button');
  const rotator = logoNode && document.createElement('div');
  if (logo && rotator) {
    logo.className = 'ps-qr__logo';
    logo.setAttribute('aria-label', 'Spin the Glass QR');
    const logoScale = (EC_RADIUS[ec] ?? 0.25) / 0.25;
    const logoSize = displayPx * 0.2 * logoScale;
    logo.style.width = `${logoSize}px`;
    logo.style.height = `${logoSize}px`;
    rotator.className = 'ps-qr__logo-rotator';
    rotator.style.width = '100%';
    rotator.style.height = '100%';
    rotator.appendChild(logoNode);
    logo.appendChild(rotator);
  }
  box.append(colorCanvas, qrCanvas);
  if (logo) box.appendChild(logo);
  stage.appendChild(box);
  tilt.appendChild(stage);
  root.appendChild(tilt);

  // Attached before the renderer is built, because `resolveCssColor` reads the
  // QR's colours back through getComputedStyle — `var(--ink)` / `var(--paper)`
  // only resolve for an element that is actually in the document. `build()`
  // below is what keeps a failure from leaving that node behind.
  container.appendChild(root);

  // ── geometry + renderer ──
  // Any of these can throw: a bad payload, no WebGL2 (Brave's fingerprinting
  // shields block it), a shader compile/link error. None of them may leave a
  // half-built .ps-qr stranded in the consumer's container.
  const build = <T>(make: () => T): T => {
    try {
      return make();
    } catch (err) {
      root.remove();
      throw err;
    }
  };

  const geo = build(() =>
    buildQRGeometry({ size, value, reserveCenter, errorCorrectionLevel: ec }),
  );
  if (geo.dots.length === 0 || geo.eyes.length === 0) {
    root.remove();
    throw new Error('Glass QR: the encoded value produced no drawable geometry.');
  }

  const renderer = build(
    () =>
      new QRGlassRenderer({
        canvas: qrCanvas,
        size,
        eyes: geo.eyes,
        occupancy: geo.occupancy,
        matrixLength: geo.matrixLength,
        gridOriginUV: geo.gridOriginUV,
        cellUV: geo.cellUV,
        dotRadius: geo.dotRadius,
        dotColor,
        backgroundColor,
      }),
  );
  renderer.updateEyeRefractionScale(eyeRefractionScale);

  // resolve dotColor for the painting clear color (via the live canvas)
  const clearColor = renderer.resolveCssColorString(dotColor);
  const defaultColor = renderer.resolveCssColor(dotColor);

  const splashSpeed = 3000 / colorSplash;
  const colorPaint = build(
    () =>
      new PaintingTexture({
        canvas: colorCanvas,
        size: size / 22.2,
        maxAge: 240,
        radius: size / 333,
        intensityFactor: 0.8,
        useColor: true,
        clearColor,
        splashSpeed,
        ringStart,
        ringEnd,
      }),
  );
  const shapePaint = build(
    () =>
      new PaintingTexture({
        size: size / 22.2,
        maxAge: 48,
        radius: size / 426,
        intensityFactor: 0.4,
        splashSpeed,
        ringStart,
        ringEnd,
      }),
  );

  // ── eye hover state ──
  const state = {
    currentScale: [1, 1, 1],
    targetScale: [1, 1, 1],
    currentColor: [defaultColor.slice(), defaultColor.slice(), defaultColor.slice()] as number[][],
    defaultColor,
    hoverGroup: -1,
    clickColor: null as number[] | null,
    hoverRgb: hexToRgb(nextColor(undefined as unknown as string)),
    lerpMultiplier: 1,
  };
  const eyeBounds: number[][] = [];
  for (let e = 0; e < 3; e++) {
    const eye = geo.eyes[3 * e];
    eyeBounds.push([
      eye.x / size,
      eye.y / size,
      (eye.x + eye.width) / size,
      (eye.y + eye.height) / size,
    ]);
  }

  // ── lens layers ──
  const layers: LensLayer[] = build(() =>
    Array.from({ length: 5 }, () => ({
      w: 0,
      h: 0,
      tween: null,
      gen: new LensGenerator(),
    })),
  );
  let activeLayer = 0;
  const compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = 128;
  compositeCanvas.height = 128;
  const compositeCtx = compositeCanvas.getContext('2d')!;

  function triggerSplash() {
    activeLayer = (activeLayer + 1) % 5;
    layers[activeLayer].tween = {
      start: performance.now(),
      dur: lensDuration,
      from: 4,
      to: SIZE_TO * HALF_SIZE,
    };
  }

  // step lens tweens; returns the displacementRef (or null)
  function updateLens(now: number) {
    const live: { i: number; w: number; h: number; canvas: HTMLCanvasElement | OffscreenCanvas }[] =
      [];
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (layer.tween) {
        const p = (now - layer.tween.start) / layer.tween.dur;
        if (p >= 1) {
          layer.w = layer.h = 0;
          layer.tween = null;
        } else {
          const v = layer.tween.from + (layer.tween.to - layer.tween.from) * ease(p);
          layer.w = layer.h = v;
        }
      }
      if (layer.w > 3 && layer.h > 3) {
        const canvas = layer.gen.generate({
          lensHalfWidth: layer.w,
          lensHalfHeight: layer.h,
          borderRadius: Math.min(layer.w, layer.h),
          depth: lensDepth,
          sdfBoundary: true,
          edgeFalloff: true,
        });
        live.push({ i, w: layer.w, h: layer.h, canvas });
      }
    }
    if (live.length === 0) return null;

    const scaleFor = (w: number, h: number): [number, number] => {
      const o = Math.min(Math.max((2 * w) / S, (2 * h) / S), 1);
      return [scaleX * o, scaleY * o];
    };

    if (live.length === 1) {
      const { w, h, canvas } = live[0];
      return {
        canvas: canvas as TexImageSource,
        lensOrigin: [0.5 - w / S, 0.5 - h / S] as [number, number],
        lensSize: [(2 * w) / S, (2 * h) / S] as [number, number],
        scale: scaleFor(w, h),
        chromaAmount,
      };
    }

    const maxW = Math.max(...live.map((l) => l.w));
    const maxH = Math.max(...live.map((l) => l.h));
    compositeCtx.globalCompositeOperation = 'source-over';
    compositeCtx.clearRect(0, 0, 128, 128);
    compositeCtx.fillStyle = 'rgb(128,128,128)';
    compositeCtx.fillRect(0, 0, 128, 128);
    const count = layers.length;
    live
      .sort((a, b) => ((activeLayer - b.i + count) % count) - ((activeLayer - a.i + count) % count))
      .forEach(({ w, h, canvas }) => {
        const dw = (w / maxW) * 128;
        const dh = (h / maxH) * 128;
        compositeCtx.drawImage(canvas as CanvasImageSource, (128 - dw) / 2, (128 - dh) / 2, dw, dh);
      });
    return {
      canvas: compositeCanvas as TexImageSource,
      lensOrigin: [0.5 - maxW / S, 0.5 - maxH / S] as [number, number],
      lensSize: [(2 * maxW) / S, (2 * maxH) / S] as [number, number],
      scale: scaleFor(maxW, maxH),
      chromaAmount,
    };
  }

  // ── springs (tilt + logo spin) ──
  const tiltX = new Spring(0, 400, 30, 1);
  const tiltY = new Spring(0, 400, 30, 1);
  const spin = new Spring(0, 26.7, 4.1, 0.2);
  let clickCounter = 0;
  let springRaf: number | null = null;
  let springLast = 0;
  function springTick(now: number) {
    const dt = springLast ? Math.min((now - springLast) / 1000, 0.064) : 0;
    springLast = now;
    tiltX.step(dt);
    tiltY.step(dt);
    spin.step(dt);
    tilt.style.transform = `rotateX(${tiltX.value}deg) rotateY(${tiltY.value}deg)`;
    if (rotator) rotator.style.transform = `rotateY(${spin.value}deg)`;
    if (tiltX.settled && tiltY.settled && spin.settled) {
      springRaf = null;
      springLast = 0;
    } else {
      springRaf = requestAnimationFrame(springTick);
    }
  }
  function wakeSprings() {
    if (springRaf == null) {
      springLast = 0;
      springRaf = requestAnimationFrame(springTick);
    }
  }

  // ── QR render loop ──
  let visible = false;
  let qrRaf: number | null = null;
  let lastRender = 0;
  let lastPointerMove = 0;

  function renderFrame(now: number) {
    const dt = Math.min(((now - lastRender) / 1000) * 100, 2);
    lastRender = now;
    const mouseRecent = now - lastPointerMove < 1000;

    const disp = updateLens(now);
    if (disp && disp.canvas) {
      renderer.updateDisplacement(
        disp.canvas,
        disp.lensOrigin,
        disp.lensSize,
        disp.scale,
        disp.chromaAmount,
      );
    } else {
      renderer.clearDisplacement();
    }

    let animating = false;
    const l = 0.18 * state.lerpMultiplier;
    for (let e = 0; e < 3; e++) {
      const ds = state.targetScale[e] - state.currentScale[e];
      if (Math.abs(ds) > 0.001) {
        state.currentScale[e] += ds * l;
        animating = true;
      } else {
        state.currentScale[e] = state.targetScale[e];
      }
      renderer.updateEyeScale(e, state.currentScale[e]);
      const target =
        state.hoverGroup === e
          ? state.hoverRgb
          : state.clickColor
            ? state.clickColor
            : state.defaultColor;
      for (let c = 0; c < 3; c++) {
        const dc = target[c] - state.currentColor[e][c];
        if (Math.abs(dc) > 0.002) {
          state.currentColor[e][c] += dc * l;
          animating = true;
        } else {
          state.currentColor[e][c] = target[c];
        }
      }
      renderer.updateEyeColor(
        e,
        state.currentColor[e][0],
        state.currentColor[e][1],
        state.currentColor[e][2],
      );
    }

    renderer.draw();
    colorPaint.update(dt, mouseRecent);
    shapePaint.update(dt, mouseRecent);
    if (shapePaint.canvas)
      renderer.updatePaintingTextureForScale(shapePaint.canvas as TexImageSource);
    if (colorPaint.canvas) renderer.updatePaintingColorTexture(colorPaint.canvas as TexImageSource);

    const keepGoing =
      mouseRecent ||
      animating ||
      !!disp?.canvas ||
      colorPaint.pointCount > 0 ||
      shapePaint.pointCount > 0 ||
      colorPaint.splashCount > 0 ||
      shapePaint.splashCount > 0;
    qrRaf = visible && keepGoing ? requestAnimationFrame(renderFrame) : null;
  }
  function restartQR() {
    if (qrRaf == null) {
      lastRender = performance.now();
      qrRaf = requestAnimationFrame(renderFrame);
    }
  }

  // ── interaction ──
  function hitTestEye(clientX: number, clientY: number): number {
    const rect = qrCanvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    for (let e = 0; e < 3; e++) {
      const b = eyeBounds[e];
      if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) return e;
    }
    return -1;
  }
  function setHover(group: number) {
    state.hoverGroup = group;
    state.lerpMultiplier = 1;
    for (let t = 0; t < 3; t++) state.targetScale[t] = t === group ? 0.92 : 1;
    restartQR();
  }

  // F = the active click color (string | undefined); changing it flashes the eyes
  let fColor: string | undefined;
  let lastClickTime = 0;
  const fTimers: ReturnType<typeof setTimeout>[] = [];
  function clearFTimers() {
    while (fTimers.length) clearTimeout(fTimers.pop()!);
  }
  function setF(color: string | undefined) {
    fColor = color;
    clearFTimers();
    if (!color) {
      state.clickColor = null;
      state.hoverRgb = hexToRgb(nextColor(undefined as unknown as string));
      state.lerpMultiplier = 0.125;
      restartQR();
      return;
    }
    const now = Date.now();
    const rapid = now - lastClickTime < 2000;
    lastClickTime = now;
    const delay = 300 * (rapid ? 0 : 1);
    const rgb = hexToRgb(color);
    state.hoverRgb = hexToRgb(nextColor(color));
    state.lerpMultiplier = 0.5;
    fTimers.push(
      setTimeout(
        () => {
          state.clickColor = rgb;
          restartQR();
        },
        500 * (rapid ? 0 : 1),
      ),
    );
    if (!rapid) {
      fTimers.push(
        setTimeout(() => {
          for (let e = 0; e < 3; e++) state.targetScale[e] = 0.9;
          restartQR();
        }, delay),
      );
      fTimers.push(
        setTimeout(() => {
          for (let e = 0; e < 3; e++) state.targetScale[e] = 1;
        }, delay + 150),
      );
    }
    restartQR();
    fTimers.push(setTimeout(() => setF(undefined), 2000));
  }

  function handleClick() {
    colorPaint.onClick();
    shapePaint.onClick();
    setF(nextColor(fColor as unknown as string));
    clickCounter += 1;
    spin.set(360 * clickCounter);
    wakeSprings();
    triggerSplash();
    restartQR();
  }
  logo?.addEventListener('click', handleClick);

  function onPointerMove(e: PointerEvent) {
    // 3D tilt
    if (e.pointerType !== 'touch') {
      const rect = root.getBoundingClientRect();
      const rx = (e.clientX - rect.left) / rect.width - 0.5;
      const ry = (e.clientY - rect.top) / rect.height - 0.5;
      tiltX.set(-(12 * ry));
      tiltY.set(12 * rx);
      wakeSprings();
    }
    // mouse trail + eye hover
    if (!visible) return;
    lastPointerMove = performance.now();
    const rect = qrCanvas.getBoundingClientRect();
    const uv = {
      x: (e.clientX - rect.left) / rect.width,
      y: 1 - (e.clientY - rect.top) / rect.height,
    };
    colorPaint.updateMousePosition(uv);
    shapePaint.updateMousePosition(uv);
    if (e.pointerType !== 'touch') setHover(hitTestEye(e.clientX, e.clientY));
    restartQR();
  }
  function onPointerDown(e: PointerEvent) {
    if (visible && e.pointerType === 'touch') setHover(hitTestEye(e.clientX, e.clientY));
  }
  function onPointerLeave() {
    tiltX.set(0);
    tiltY.set(0);
    wakeSprings();
    setHover(-1);
  }
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointerleave', onPointerLeave);

  // ── visibility ──
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      if (visible) restartQR();
    },
    { rootMargin: '300px 0px' },
  );
  io.observe(root);
  // kick an initial draw so it shows before first interaction
  renderer.draw();
  if (colorPaint.canvas) renderer.updatePaintingColorTexture(colorPaint.canvas as TexImageSource);

  // ── cleanup + live reconfigure (the Glass Tuner tweaks refraction/bloom knobs) ──
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (qrRaf != null) cancelAnimationFrame(qrRaf);
    if (springRaf != null) cancelAnimationFrame(springRaf);
    clearFTimers();
    io.disconnect();
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('pointerleave', onPointerLeave);
    logo?.removeEventListener('click', handleClick);
    renderer.cleanUp();
    colorPaint.cleanUp();
    shapePaint.cleanUp();
    layers.forEach((l) => l.gen.dispose());
    root.remove();
  };

  // The handle is a callable (the original shape) that also carries `.dispose()`,
  // matching core's `mountGlass` — new code should prefer the named method.
  const reconfigure = (patch: Partial<GlassQRParams>) => {
    // scaleX/scaleY/chromaAmount/lensDepth/lensDuration are captured by the
    // per-frame bloom closures, so updating them here applies to the next bloom.
    if (patch.scaleX != null) scaleX = patch.scaleX;
    if (patch.scaleY != null) scaleY = patch.scaleY;
    if (patch.chromaAmount != null) chromaAmount = patch.chromaAmount;
    if (patch.lensDepth != null) lensDepth = patch.lensDepth;
    if (patch.lensDuration != null) lensDuration = patch.lensDuration;
    if (patch.eyeRefractionScale != null)
      renderer.updateEyeRefractionScale(patch.eyeRefractionScale);
    // colour-ripple knobs — pushed into both PaintingTextures (read fresh on next click)
    if (patch.colorSplash != null) {
      const ss = 3000 / patch.colorSplash;
      colorPaint.updateSplashSpeed(ss);
      shapePaint.updateSplashSpeed(ss);
    }
    if (patch.ringStart != null) {
      colorPaint.updateRingStart(patch.ringStart);
      shapePaint.updateRingStart(patch.ringStart);
    }
    if (patch.ringEnd != null) {
      colorPaint.updateRingEnd(patch.ringEnd);
      shapePaint.updateRingEnd(patch.ringEnd);
    }
  };

  return Object.assign(dispose, { dispose, reconfigure });
}
