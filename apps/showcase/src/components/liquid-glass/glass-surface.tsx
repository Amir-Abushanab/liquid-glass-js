import * as React from 'react';
import { LiquidGlass, type LiquidGlassProps } from '@liquidglassjs/react';
import { cn } from '@/lib/utils';
import '@liquidglassjs/core/css';

export type GlassSurfaceProps = LiquidGlassProps;

/**
 * Base liquid-glass surface — a thin, restyleable wrapper over
 * @liquidglassjs/react's <LiquidGlass>. Your content sits crisply in the
 * `.ps-glass__content` layer, on top of a glass surface that frosts — and, on
 * Chromium, refracts — whatever is behind it. Because the content is in-flow, the
 * surface sizes to it, so a card needs no explicit width/height.
 *
 * You own this file: change the radius, border, or padding — it's yours now. The
 * engine stays a versioned dependency.
 */
export function GlassSurface({
  className,
  children,
  radius = 22,
  style,
  ...props
}: GlassSurfaceProps) {
  return (
    <LiquidGlass
      radius={radius}
      className={cn('relative isolate overflow-hidden', className)}
      style={{ borderRadius: radius, ...style }}
      {...props}
    >
      <div className="ps-glass__content pointer-events-auto">{children}</div>
    </LiquidGlass>
  );
}
