// @liquidglassjs/react — thin React wrapper over @liquidglassjs/core.
//
// `mountGlass` is imperative (mounts on a DOM node, returns `{ dispose }`), which
// maps exactly onto an effect: mount on the node in `useEffect`, dispose on
// cleanup. Everything here is glue — the engine lives in core.
//
//   • SSR-safe: nothing touches `window`/`document` during render; the effect
//     (client-only) reads the ref, which is null on the server.
//   • StrictMode-safe: the cleanup fully disposes, so the dev double-invoke
//     (mount → cleanup → mount) leaves no leaked filters/observers.
//   • Re-mounts only when option *values* change (deps are the scalars/refs),
//     not on every render — `mountGlass` has no live reconfigure, so a changed
//     option means dispose + remount.
//
// Consumers must import the chrome CSS once: `import '@liquidglassjs/core/css'`.

import { forwardRef, useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode, Ref, RefObject } from 'react';
import { mountGlass } from '@liquidglassjs/core';
import type { GlassOptions } from '@liquidglassjs/core';

export type { GlassOptions, GlassInstance } from '@liquidglassjs/core';

export interface LiquidGlassProps extends Omit<GlassOptions, 'class'> {
  /** Overlay / refract content. Mark a child `className="ps-glass__refract"` to bend it. */
  children?: ReactNode;
  /** Class(es) for the glass root element. */
  className?: string;
  style?: CSSProperties;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

/**
 * `<LiquidGlass radius={20} strength={16}>…</LiquidGlass>` — renders the glass
 * root and mounts the auto-selected renderer on it. Forwards a ref to the root.
 */
export const LiquidGlass = forwardRef<HTMLDivElement, LiquidGlassProps>(
  function LiquidGlass(props, forwardedRef) {
    const {
      children,
      className,
      style,
      radius,
      depth,
      dome,
      strength,
      edge,
      glow,
      chroma,
      blur,
      tint,
      spec,
      vibrancy,
      backdrop,
      source,
      refract,
      mode,
    } = props;
    const innerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      const inst = mountGlass(el, {
        radius,
        depth,
        dome,
        strength,
        edge,
        glow,
        chroma,
        blur,
        tint,
        spec,
        vibrancy,
        backdrop,
        source,
        refract,
        mode,
      });
      return () => inst.dispose();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the resolved option values
    }, [
      radius,
      depth,
      dome,
      strength,
      edge,
      glow,
      chroma,
      blur,
      tint,
      spec,
      vibrancy,
      backdrop,
      source,
      refract,
      mode,
    ]);

    return (
      <div
        ref={(node) => {
          innerRef.current = node;
          assignRef(forwardedRef, node);
        }}
        className={className}
        style={style}
      >
        {children}
      </div>
    );
  },
);

/**
 * Headless variant: attach the returned ref to your own element.
 *
 * ```tsx
 * const ref = useLiquidGlass<HTMLDivElement>({ radius: 20, refract: contentEl });
 * return <div ref={ref}>…</div>;
 * ```
 */
export function useLiquidGlass<T extends HTMLElement = HTMLDivElement>(
  options: GlassOptions = {},
): RefObject<T | null> {
  const ref = useRef<T>(null);
  const {
    radius,
    depth,
    dome,
    strength,
    edge,
    glow,
    chroma,
    blur,
    tint,
    spec,
    vibrancy,
    backdrop,
    source,
    refract,
    mode,
  } = options;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const inst = mountGlass(el, options);
    return () => inst.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the resolved option values
  }, [
    radius,
    depth,
    dome,
    strength,
    edge,
    glow,
    chroma,
    blur,
    tint,
    spec,
    vibrancy,
    backdrop,
    source,
    refract,
    mode,
  ]);
  return ref;
}

// Visual effect bindings (typeface, alpha-shaped glass, movable lens, morphing
// button, ripple bloom).
export { GlassText, GlassShape, GlassLens, GlassButton, GlassRipple } from './effects';
export type {
  GlassTextProps,
  GlassShapeProps,
  GlassLensProps,
  GlassButtonProps,
  GlassRippleProps,
} from './effects';
