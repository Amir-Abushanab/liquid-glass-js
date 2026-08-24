// React bindings for the visual glass effects — thin wrappers over the core
// imperative mounts (same shape as <LiquidGlass> over mountGlass). Each mounts on
// a ref in an effect and disposes on cleanup; SSR-safe (refs are null on the
// server) and StrictMode-safe (dispose fully tears down). Re-mounts when the
// resolved option values change.
//
// The `{ target, host }` mounts apply the filter to `target` and append the hidden
// <svg><filter> to `host`; here `host` is the wrapper and `target` is the content
// inside it — none of these move your children.

import { useEffect, useRef } from 'react';
import type {
  CSSProperties,
  MouseEventHandler,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
} from 'react';
import {
  mountGlassText,
  type GlassTextParams,
  mountGlassShape,
  type GlassShapeParams,
  type GlassShapeSource,
  mountGlassLens,
  type GlassLensParams,
  mountGlassLoupe,
  type GlassLoupeOptions,
  type GlassLoupeParams,
  type GlassLoupeSample,
  type GlassLoupe as GlassLoupeInstance,
  mountGlassButton,
  type GlassButtonOptions,
  type GlassButton as GlassButtonInstance,
  mountSvgRipple,
  type SvgRippleParams,
} from '@liquidglassjs/core';

// ── Glass typeface: refract live text through the glyph-shaped filter ──
export interface GlassTextProps extends Partial<GlassTextParams> {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** CSS colour for the specular glint (default white). */
  glint?: string;
}

export function GlassText({ children, className, style, glint, ...params }: GlassTextProps) {
  const host = useRef<HTMLSpanElement>(null);
  const target = useRef<HTMLSpanElement>(null);
  const inst = useRef<ReturnType<typeof mountGlassText> | null>(null);
  // Mount once (glint is baked in at mount); tune the params live below — no re-mount.
  useEffect(() => {
    if (!host.current || !target.current) return;
    const i = mountGlassText({ target: target.current, host: host.current, glint, ...params });
    inst.current = i;
    return () => {
      i.dispose();
      inst.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-mount only on glint; params reconfigure below
  }, [glint]);
  const key = JSON.stringify(params);
  useEffect(() => {
    inst.current?.reconfigure(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key captures params
  }, [key]);
  return (
    <span
      ref={host}
      className={className}
      style={{ position: 'relative', display: 'inline-block', ...style }}
    >
      <span ref={target}>{children}</span>
    </span>
  );
}

// ── Glass shape: liquid glass clipped to any alpha (inline <svg>, <img>, <canvas>) ──
export interface GlassShapeProps extends Partial<GlassShapeParams> {
  /** An inline `<svg>`, `<img>`, or `<canvas>` — used as both the filtered target and the map's shape. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  glint?: string;
}

export function GlassShape({ children, className, style, glint, ...params }: GlassShapeProps) {
  const host = useRef<HTMLSpanElement>(null);
  const inst = useRef<ReturnType<typeof mountGlassShape> | null>(null);
  useEffect(() => {
    const wrap = host.current;
    const el = wrap?.querySelector<HTMLElement>('svg, img, canvas');
    if (!wrap || !el) return;
    const i = mountGlassShape({
      target: el,
      host: wrap,
      source: el as unknown as GlassShapeSource,
      glint,
      ...params,
    });
    inst.current = i;
    return () => {
      i.dispose();
      inst.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-mount only on glint; params reconfigure below
  }, [glint]);
  const key = JSON.stringify(params);
  useEffect(() => {
    inst.current?.reconfigure(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key captures params
  }, [key]);
  return (
    <span
      ref={host}
      className={className}
      style={{ position: 'relative', display: 'inline-block', lineHeight: 0, ...style }}
    >
      {children}
    </span>
  );
}

// ── Glass lens: a movable refraction lens over live content (follows the pointer) ──
export interface GlassLensProps extends Partial<GlassLensParams> {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Lens size in px (default 150). */
  width?: number;
  height?: number;
  glint?: string;
}

export function GlassLens({
  children,
  className,
  style,
  width = 150,
  height = 150,
  glint,
  ...params
}: GlassLensProps) {
  const host = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLDivElement>(null);
  const inst = useRef<ReturnType<typeof mountGlassLens> | null>(null);
  useEffect(() => {
    const wrap = host.current;
    if (!wrap || !target.current) return;
    const i = mountGlassLens({
      target: target.current,
      host: wrap,
      lensW: width,
      lensH: height,
      glint,
      ...params,
    });
    inst.current = i;
    const centre = () => {
      const r = wrap.getBoundingClientRect();
      i.setPos((r.width - width) / 2, (r.height - height) / 2);
    };
    centre();
    const move = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      i.setPos(e.clientX - r.left - width / 2, e.clientY - r.top - height / 2);
    };
    wrap.addEventListener('pointermove', move);
    wrap.addEventListener('pointerleave', centre);
    return () => {
      wrap.removeEventListener('pointermove', move);
      wrap.removeEventListener('pointerleave', centre);
      i.dispose();
      inst.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-mount on glint/size; params reconfigure below
  }, [glint, width, height]);
  const key = JSON.stringify(params);
  useEffect(() => {
    inst.current?.reconfigure(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key captures params
  }, [key]);
  return (
    <div ref={host} className={className} style={{ position: 'relative', ...style }}>
      <div ref={target}>{children}</div>
    </div>
  );
}

// ── Glass loupe: the iOS "hold on a word" magnifier ──
// Split in two on purpose. The hook takes a ref to content you already render, so
// the loupe can magnify a region of an existing tree without you restructuring it
// (and, with `trigger: 'none'`, be driven from your own gesture code). The
// component is the batteries-included wrapper for the common case.

/**
 * Mount-only options — changing one of these remounts the loupe. `longPressMs` is
 * deliberately absent: it lives in GlassLoupeParams and reconfigures live, so it
 * flows through the params path below instead of forcing a remount.
 */
type LoupeSetup = Pick<
  GlassLoupeOptions,
  'trigger' | 'moveTolerance' | 'snapToLine' | 'clamp' | 'suppressNative' | 'glint'
>;

export interface UseGlassLoupeOptions extends Partial<GlassLoupeParams>, LoupeSetup {
  /** Skip mounting (e.g. gate the magnifier behind a user setting). */
  disabled?: boolean;
  onShow?: (sample: GlassLoupeSample) => void;
  onMove?: (sample: GlassLoupeSample) => void;
  onHide?: () => void;
}

/**
 * Magnify the element in `ref`. Returns a ref to the live instance, so a
 * `trigger: 'none'` loupe can be driven imperatively:
 * `loupe.current?.show(e.clientX, e.clientY)`.
 */
export function useGlassLoupe<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T | null>,
  options: UseGlassLoupeOptions = {},
): RefObject<GlassLoupeInstance | null> {
  const {
    disabled,
    trigger,
    moveTolerance,
    snapToLine,
    clamp,
    suppressNative,
    glint,
    onShow,
    onMove,
    onHide,
    ...params
  } = options;
  const inst = useRef<GlassLoupeInstance | null>(null);
  // Handlers are re-created on every render; routing them through a ref keeps the
  // callbacks passed to core stable, so a parent re-render never remounts the loupe.
  const handlers = useRef({ onShow, onMove, onHide });
  handlers.current = { onShow, onMove, onHide };
  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;
    const i = mountGlassLoupe({
      source: el,
      trigger,
      moveTolerance,
      snapToLine,
      clamp,
      suppressNative,
      glint,
      onShow: (s) => handlers.current.onShow?.(s),
      onMove: (s) => handlers.current.onMove?.(s),
      onHide: () => handlers.current.onHide?.(),
      ...params,
    });
    inst.current = i;
    return () => {
      i.dispose();
      inst.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount on setup only; params reconfigure below
  }, [ref, disabled, trigger, moveTolerance, snapToLine, clamp, suppressNative, glint]);
  const key = JSON.stringify(params);
  useEffect(() => {
    inst.current?.reconfigure(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key captures params
  }, [key]);
  return inst;
}

export interface GlassLoupeProps extends UseGlassLoupeOptions {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Element to render as the magnified region. Default `'div'`. */
  as?: 'div' | 'section' | 'article' | 'p' | 'span';
}

/** `<GlassLoupe>…</GlassLoupe>` — long-press its children to magnify them. */
export function GlassLoupe({
  children,
  className,
  style,
  as: Tag = 'div',
  ...options
}: GlassLoupeProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGlassLoupe(ref, options);
  // One cast so `as` can vary the tag without each intrinsic element's own ref type
  // leaking into the signature — every option here takes an HTMLElement ref.
  const Comp = Tag as 'div';
  return (
    // The loupe appends itself to this element's parent, so the clone keeps the
    // same CSS ancestors as the original.
    <Comp ref={ref} className={className} style={style}>
      {children}
    </Comp>
  );
}

// ── Glass button: the glass reshapes when its (string) label changes ──
export interface GlassButtonProps extends GlassButtonOptions {
  /** The label. Changing it morphs the glass to fit. Text labels only. */
  children?: string;
  className?: string;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

export function GlassButton({ children, className, style, onClick, ...opts }: GlassButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const inst = useRef<GlassButtonInstance | null>(null);
  // Split the mount-only geometry from the reconfigurable surface params, so tuning
  // strength/chroma/etc. is live and only radius/duration/pulse re-mount.
  const { radius, duration, pulse, backdrop, ...params } = opts;
  const structKey = JSON.stringify({ radius, duration, pulse, backdrop });
  // Render an empty button; the label is driven imperatively (mountGlassButton
  // moves children into its own label span, which would fight React otherwise).
  useEffect(() => {
    if (!ref.current) return;
    const b = mountGlassButton(ref.current, opts);
    inst.current = b;
    void b.setContent(children ?? '', true); // initial label, no morph
    return () => {
      b.dispose();
      inst.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-mount on geometry; params + label handled below
  }, [structKey]);
  const paramsKey = JSON.stringify(params);
  useEffect(() => {
    inst.current?.reconfigure(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key captures params
  }, [paramsKey]);
  useEffect(() => {
    void inst.current?.setContent(children ?? ''); // morph to the new label
  }, [children]);
  return <button ref={ref} type="button" className={className} style={style} onClick={onClick} />;
}

// ── Glass ripple: a press spawns an expanding refraction bloom over the pane ──
const RIPPLE_PANE =
  'radial-gradient(120% 120% at 30% 20%, #56d3ff, transparent 60%),' +
  'radial-gradient(120% 120% at 80% 90%, #ff5db1, transparent 60%),' +
  'linear-gradient(135deg, #7b3cff, #12d3ff)';

export interface GlassRippleProps extends Partial<SvgRippleParams> {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** CSS background for the refracted pane (what the ripple bends). Defaults to a glass gradient. */
  pane?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

export function GlassRipple({
  children,
  className,
  style,
  pane,
  onClick,
  ...params
}: GlassRippleProps) {
  const host = useRef<HTMLButtonElement>(null);
  const target = useRef<HTMLSpanElement>(null);
  const inst = useRef<ReturnType<typeof mountSvgRipple> | null>(null);
  useEffect(() => {
    if (!host.current || !target.current) return;
    const i = mountSvgRipple({ target: target.current, host: host.current, ...params });
    inst.current = i;
    return () => {
      i.dispose();
      inst.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; params reconfigure below
  }, []);
  const key = JSON.stringify(params);
  useEffect(() => {
    inst.current?.reconfigure(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key captures params
  }, [key]);
  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const t = target.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    inst.current?.press((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  };
  return (
    <button
      ref={host}
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={className}
      style={{ position: 'relative', overflow: 'hidden', border: 0, cursor: 'pointer', ...style }}
    >
      <span
        ref={target}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, background: pane ?? RIPPLE_PANE }}
      />
      <span style={{ position: 'relative' }}>{children}</span>
    </button>
  );
}
