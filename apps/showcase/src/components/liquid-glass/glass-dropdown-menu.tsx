"use client";

import * as React from "react";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { LiquidGlass } from "@liquidglassjs/react";
import { cn } from "@/lib/utils";
import "@liquidglassjs/core/css";

/**
 * Liquid-glass Dropdown Menu — Base UI's Menu (anchored positioning, roving focus,
 * typeahead, ARIA) with a frosted glass popup panel. Behavior is Base UI's; the
 * glass is the skin. Same frost recipe as GlassDialog, anchored to the trigger.
 *
 *   <GlassDropdownMenu>
 *     <GlassDropdownMenuTrigger>Actions</GlassDropdownMenuTrigger>
 *     <GlassDropdownMenuContent>
 *       <GlassDropdownMenuItem>Profile</GlassDropdownMenuItem>
 *       <GlassDropdownMenuSeparator />
 *       <GlassDropdownMenuItem>Sign out</GlassDropdownMenuItem>
 *     </GlassDropdownMenuContent>
 *   </GlassDropdownMenu>
 */

const GlassDropdownMenu = BaseMenu.Root;
const GlassDropdownMenuTrigger = BaseMenu.Trigger;

function GlassDropdownMenuContent({
  className,
  children,
  sideOffset = 8,
  strength = 12,
  chroma = 0.4,
  dome = 10,
  depth = 8,
  edge = 0.9,
  glow = 0.3,
  ...props
}: React.ComponentProps<typeof BaseMenu.Popup> & {
  sideOffset?: number;
  strength?: number;
  chroma?: number;
  dome?: number;
  depth?: number;
  edge?: number;
  glow?: number;
}) {
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner sideOffset={sideOffset} className="z-50 outline-none">
        <BaseMenu.Popup
          className={cn(
            "relative min-w-44 origin-[var(--transform-origin)] overflow-hidden rounded-2xl p-1.5 shadow-2xl outline-none",
            "transition-[transform,opacity] duration-150 ease-out",
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {/* frosted glass panel — refracts the page behind the menu on Chromium */}
          <LiquidGlass
            mode="frost"
            radius={16}
            strength={strength}
            chroma={chroma}
            dome={dome}
            depth={depth}
            edge={edge}
            glow={glow}
            className="pointer-events-none absolute inset-0"
          />
          <div className="relative z-10">{children}</div>
        </BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
}

function GlassDropdownMenuItem({ className, ...props }: React.ComponentProps<typeof BaseMenu.Item>) {
  return (
    <BaseMenu.Item
      className={cn(
        "relative flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none select-none",
        "data-[highlighted]:bg-white/15 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function GlassDropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof BaseMenu.Separator>) {
  return <BaseMenu.Separator className={cn("mx-1 my-1 h-px bg-white/15", className)} {...props} />;
}

export {
  GlassDropdownMenu,
  GlassDropdownMenuTrigger,
  GlassDropdownMenuContent,
  GlassDropdownMenuItem,
  GlassDropdownMenuSeparator,
};
