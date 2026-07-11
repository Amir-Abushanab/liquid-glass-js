import * as React from "react";
import { LiquidGlass, type LiquidGlassProps } from "@liquidglassjs/react";
import { cn } from "@/lib/utils";
import "@liquidglassjs/core/css";

export type GlassSurfaceProps = LiquidGlassProps;

/**
 * Base liquid-glass surface — a thin, restyleable wrapper over
 * @liquidglassjs/react's <LiquidGlass>. Children are wrapped in the
 * `.ps-glass__refract` layer so the SVG refraction bends your real content.
 *
 * You own this file: change the radius, the border, the content wrapper — it's
 * yours now. The refraction engine stays a versioned dependency.
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
      className={cn("relative isolate overflow-hidden", className)}
      style={{ borderRadius: radius, ...style }}
      {...props}
    >
      <div className="ps-glass__refract">{children}</div>
    </LiquidGlass>
  );
}
