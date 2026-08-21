'use client';

import * as React from 'react';
import { Menu as BaseMenu } from '@base-ui/react/menu';
import { LiquidGlass } from '@liquidglassjs/react';
import { cn } from '@/lib/utils';
import '@liquidglassjs/core/css';

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

/**
 * The glass rim has to trace the same curve as the panel it fills. `rounded-2xl` is a
 * theme token — 18px under the default shadcn `--radius`, something else in the next
 * app — so a hardcoded number on the glass silently stops matching and you get two
 * rounded rectangles a couple of px apart at every corner. Read the real one instead.
 */
function usePanelRadius(el: HTMLElement | null, fallback = 16) {
  const [radius, setRadius] = React.useState(fallback);
  React.useLayoutEffect(() => {
    if (!el) return;
    const read = () => {
      const r = parseFloat(getComputedStyle(el).borderTopLeftRadius);
      if (r) setRadius((prev) => (prev === r ? prev : r));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return radius;
}

/**
 * Theming: with nothing to refract a menu frosts, and the frosted fill reads
 * `--glass-frost-bg` (from @liquidglassjs/core/css), which defaults to 55% of
 * `--glass-paper`. Map `--glass-paper` to your own paper colour so it follows your
 * theme, and thin `--glass-frost-bg` if the wash is hiding the refraction underneath:
 *   `.dark { --glass-paper: #0a0a0a; }`
 *   `[role='menu'] { --glass-frost-bg: rgb(255 255 255 / 34%); }`
 */
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
  refract,
  backdrop,
  ...props
}: React.ComponentProps<typeof BaseMenu.Popup> & {
  sideOffset?: number;
  strength?: number;
  chroma?: number;
  dome?: number;
  depth?: number;
  edge?: number;
  glow?: number;
  /**
   * Element to refract. Given one, the glass takes the SVG path and bends that
   * content in every browser; without one there is nothing behind this to filter and
   * it falls back to a frosted blur, which is the sensible default for a surface that
   * floats over arbitrary app content.
   */
  refract?: HTMLElement | null;
  /**
   * A CSS background (an *image* — gradient or url, not a bare colour) to refract
   * instead. A menu is portalled to the end of the body and floats over whatever
   * happens to be under it, so there is usually no single element to hand `refract`.
   * Note this path paints an opaque panel: the glass refracts the background you give
   * it rather than the page, so nothing behind the menu shows through. Left unset, the
   * menu frosts instead — see the note on the popup below.
   */
  backdrop?: string;
}) {
  // A callback ref, not useRef: the popup mounts in a later phase than this
  // component, so a layout effect keyed on a stable ref object reads null once and
  // never runs again. This re-runs the moment the node actually attaches.
  const [popupEl, setPopupEl] = React.useState<HTMLDivElement | null>(null);
  const radius = usePanelRadius(popupEl);

  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner sideOffset={sideOffset} className="z-50 outline-none">
        <BaseMenu.Popup
          ref={setPopupEl}
          className={cn(
            'relative min-w-44 origin-[var(--transform-origin)] overflow-hidden rounded-2xl p-1.5 shadow-2xl outline-none',
            'transition-[transform,opacity] duration-150 ease-out',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            className,
          )}
          {...props}
        >
          {/* Glass panel. With a `refract` target or a `backdrop` it takes the SVG path
              and bends real content in every browser; with neither it falls back to a
              frosted blur, which only refracts on Chromium. */}
          <LiquidGlass
            refract={refract ?? undefined}
            backdrop={backdrop}
            radius={radius}
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

function GlassDropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof BaseMenu.Item>) {
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

function GlassDropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof BaseMenu.Separator>) {
  return <BaseMenu.Separator className={cn('mx-1 my-1 h-px bg-white/15', className)} {...props} />;
}

export {
  GlassDropdownMenu,
  GlassDropdownMenuTrigger,
  GlassDropdownMenuContent,
  GlassDropdownMenuItem,
  GlassDropdownMenuSeparator,
};
