import * as React from "react";
import {
  GlassSurface,
  type GlassSurfaceProps,
} from "@/components/liquid-glass/glass-surface";
import { cn } from "@/lib/utils";

export type GlassCardProps = GlassSurfaceProps;

/**
 * A liquid-glass card: <GlassSurface> plus card padding, a hairline border, and
 * a shadow. Built on the glass-surface primitive (installed automatically as a
 * registry dependency). Restyle the className freely.
 */
export function GlassCard({ className, children, ...props }: GlassCardProps) {
  return (
    <GlassSurface
      className={cn(
        "border border-white/15 p-6 text-foreground shadow-xl",
        className,
      )}
      {...props}
    >
      {children}
    </GlassSurface>
  );
}
