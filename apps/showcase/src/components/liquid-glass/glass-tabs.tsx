'use client';

import * as React from 'react';
import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { cubicBezier, mountGlassLens, type MapProfile } from '@liquidglassjs/core';
import { cn } from '@/lib/utils';
import '@liquidglassjs/core/css';

/**
 * Liquid-glass Tabs, a segmented control: Base UI's Tabs (roving focus, keyboard nav,
 * ARIA) under a glass pill that slides to the active tab. Behavior is Base UI's; the
 * glass is the skin.
 *
 * The pill is a real lens (mountGlassLens) over the label row, not a frosted panel:
 * a panel with nothing behind it to filter falls back to a blur, which outside
 * Chromium is a plain white wash.
 *
 * - The labels bend only while the pill travels. The displacement swells from zero
 *   and back over the slide, so at rest they're geometrically untouched and read as
 *   crisp as the rest of the page. The filter stays mounted the whole time: taking
 *   it off and on would change how the row is rasterised, and the labels would look
 *   bolder for the length of every switch.
 * - The pill and the lens move on one clock, a single tween, rather than a CSS
 *   transition followed frame by frame. The two start a frame apart otherwise, and
 *   on an overshooting curve the lens ran ~18px ahead of the pill early in a slide.
 * - A tab can carry an icon and an accent (`color`). The icon wears the accent in
 *   every state, and the pill takes a wash of it while that tab is active.
 * - `fit="equal"` splits the width evenly (labels of a kind); `fit="auto"` sizes each
 *   tab to its label, and the pill and lens take the new tab's width as they go. A
 *   list wider than its container scrolls inside its own frame.
 *
 *   <GlassTabs defaultValue="all">
 *     <GlassTabsList fit="auto">
 *       <GlassTabsTab value="all" icon={<LayoutGrid />} color="#e0922f">All</GlassTabsTab>
 *       <GlassTabsTab value="comics" icon={<Brush />} color="#5aa9ff">Comics</GlassTabsTab>
 *     </GlassTabsList>
 *     <GlassTabsPanel value="all">…</GlassTabsPanel>
 *   </GlassTabs>
 */

const GlassTabs = BaseTabs.Root;

// Settles with a slight overshoot, the way a physical switch lands.
const SLIDE_EASE = cubicBezier(0.34, 1.35, 0.5, 1);
const SLIDE_MS = 300;

type Box = { x: number; y: number; w: number; h: number };

function GlassTabsList({
  className,
  children,
  fit = 'equal',
  strength = 12,
  chroma = 0.4,
  dome = 10,
  depth = 8,
  edge = 0.9,
  glow = 0.3,
  blur = 0,
  shade = 0,
  profile,
  ...props
}: React.ComponentProps<typeof BaseTabs.List> & {
  /** `equal` splits the width evenly; `auto` sizes each tab to its label. */
  fit?: 'equal' | 'auto';
  strength?: number;
  chroma?: number;
  dome?: number;
  depth?: number;
  edge?: number;
  glow?: number;
  blur?: number;
  shade?: number;
  profile?: MapProfile;
}) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const labelsRef = React.useRef<HTMLDivElement>(null);
  const pillRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const list = listRef.current;
    const labels = labelsRef.current;
    const pill = pillRef.current;
    if (!list || !labels || !pill) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    // The active tab's box in the label row's own px. Layout offsets rather than
    // rects, so a transform above the control (a dialog scaling in) can't skew what
    // the lens is baked to. The row is positioned, so it's every tab's offset parent.
    const activeTab = () => labels.querySelector<HTMLElement>('[role="tab"][data-active]');
    const boxOf = (tab: HTMLElement): Box => ({
      x: tab.offsetLeft,
      y: tab.offsetTop,
      w: tab.offsetWidth,
      h: tab.offsetHeight,
    });

    let lens: ReturnType<typeof mountGlassLens> | null = null;
    let at: Box | null = null;
    let raf = 0;

    // The refraction is decoration; the control is not. If the lens can't be mounted
    // (or has no box yet, inside something still hidden) the pill still moves, and a
    // later placement tries again.
    const ensureLens = (b: Box) => {
      if (lens || !b.w || !b.h) return;
      try {
        lens = mountGlassLens({
          target: labels,
          host: list,
          lensW: b.w,
          lensH: b.h,
          radius: b.h / 2,
          strength,
          profile,
          chroma,
          dome,
          depth,
          edge,
          glow,
          blur,
          shade,
        });
        lens.setActive(true);
        lens.setDisplScale(0);
      } catch {
        lens = null;
      }
    };

    // One writer for the pill and the lens, from the same numbers. The pill sits in
    // the list; the lens and the tabs in the row, which the list's padding offsets.
    const place = (b: Box) => {
      at = b;
      pill.style.width = `${b.w}px`;
      pill.style.height = `${b.h}px`;
      pill.style.transform = `translate(${labels.offsetLeft + b.x}px, ${labels.offsetTop + b.y}px)`;
      lens?.setPos(b.x, b.y);
    };

    // The accent of whatever is active washes the pill; a tab without one clears it.
    const tint = (tab: HTMLElement) => {
      const accent = getComputedStyle(tab).getPropertyValue('--glass-tab-accent').trim();
      list.style.setProperty('--glass-tabs-on', accent || 'transparent');
    };

    const jump = (tab: HTMLElement) => {
      cancelAnimationFrame(raf);
      const b = boxOf(tab);
      ensureLens(b);
      lens?.setSize(b.w, b.h);
      place(b);
      lens?.setDisplScale(0);
      tint(tab);
      list.dataset.measured = '';
    };

    const slide = (tab: HTMLElement) => {
      const to = boxOf(tab);
      if (!at || reduced.matches) return jump(tab);
      cancelAnimationFrame(raf);
      ensureLens(to);
      // The lens can't follow a width change frame by frame (setSize re-bakes the map),
      // so it takes the destination width up front. The only frames where that could
      // show are the ones where the displacement is bending the labels anyway.
      lens?.setSize(to.w, to.h);
      tint(tab);
      const from = at;
      const t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / SLIDE_MS);
        const e = SLIDE_EASE(k);
        place({
          x: from.x + (to.x - from.x) * e,
          y: from.y + (to.y - from.y) * e,
          w: from.w + (to.w - from.w) * e,
          h: to.h,
        });
        // Zero at both ends, full in the middle: the glass has no edge to be caught at.
        lens?.setDisplScale(Math.sin(Math.PI * k));
        if (k < 1) raf = requestAnimationFrame(step);
        else {
          place(to);
          lens?.setDisplScale(0);
        }
      };
      raf = requestAnimationFrame(step);
    };

    let current = activeTab();
    if (current) jump(current);

    // Base UI marks the active tab with `data-active`, whether the tabs are
    // controlled or not; follow the mark.
    const mo = new MutationObserver(() => {
      const next = activeTab();
      if (!next || next === current) return;
      current = next;
      slide(next);
      // Where the list has outgrown its frame, keep the selection in view.
      // `nearest` on both axes, so this never scrolls a page the control fits in.
      next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    mo.observe(labels, { subtree: true, attributeFilter: ['data-active'] });

    // The frame as well as the row: a reflow of the columns need not change the
    // row's own box.
    const ro = new ResizeObserver(() => {
      const tab = activeTab();
      if (tab) jump(tab);
    });
    ro.observe(list);
    ro.observe(labels);

    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      ro.disconnect();
      lens?.dispose();
    };
    // Re-mount the lens when the glass params change (so the Tuner is live).
  }, [strength, chroma, dome, depth, edge, glow, blur, shade, profile]);

  return (
    <BaseTabs.List
      ref={listRef}
      data-fit={fit}
      className={cn(
        'group/tabs relative isolate inline-flex max-w-full overflow-x-auto rounded-full p-1 ring-1 ring-white/15',
        // The rounded ends and a clipped tab already say there's more; a scrollbar
        // under a glass pill would be a second, worse affordance.
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      {...props}
    >
      {/* The lens filters this row, so the labels are what bends. Positioned, so it's
          the tabs' offset parent and the pill can be placed from their layout boxes. */}
      <div
        ref={labelsRef}
        className={cn(
          'relative shrink-0 gap-1',
          fit === 'auto' ? 'inline-flex' : 'inline-grid auto-cols-fr grid-flow-col',
        )}
      >
        {children}
      </div>
      {/* Chrome only: rim, shadow and the active accent's wash. The refraction is
          the filter on the row above, so this sits over the label, not behind it.
          Held back until the script has placed it on a measured box. */}
      <div
        ref={pillRef}
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute top-0 left-0 z-10 rounded-full opacity-0',
          'group-data-[measured]/tabs:opacity-100',
          'bg-[color-mix(in_oklab,var(--glass-tabs-on,transparent)_15%,transparent)] transition-[background-color] duration-200',
          'shadow-[inset_0_1px_0_rgb(255_255_255/40%),inset_0_0_0_1px_rgb(255_255_255/14%),0_2px_10px_-2px_rgb(0_0_0/35%)]',
        )}
      />
    </BaseTabs.List>
  );
}

function GlassTabsTab({
  className,
  style,
  icon,
  color,
  children,
  ...props
}: React.ComponentProps<typeof BaseTabs.Tab> & {
  /** An icon before the label. */
  icon?: React.ReactNode;
  /** Accent for the icon, and for the pill's wash while this tab is active. */
  color?: string;
}) {
  return (
    <BaseTabs.Tab
      className={cn(
        'relative z-0 inline-flex cursor-pointer items-center justify-center gap-[0.55ch] whitespace-nowrap rounded-full px-4 py-1.5 text-center text-sm font-medium outline-none select-none transition-colors',
        // Opaque, not `text-white/65`. These labels are inside the element the lens
        // filters, and the filter recombines three separately-displaced copies by
        // adding them; on a partly transparent pixel the alphas add too, so
        // translucent text comes back darker and colour-shifted (a warm cast on
        // white). Dim the label with an opaque colour instead of an alpha.
        'text-[#c2d2e6] data-[active]:text-white',
        'focus-visible:ring-2 focus-visible:ring-white/50',
        className,
      )}
      style={color ? ({ ...style, '--glass-tab-accent': color } as React.CSSProperties) : style}
      {...props}
    >
      {icon != null && (
        <span
          aria-hidden="true"
          className="inline-flex size-[1.15em] shrink-0 text-[var(--glass-tab-accent,currentColor)] [&_svg]:size-full"
        >
          {icon}
        </span>
      )}
      {children}
    </BaseTabs.Tab>
  );
}

function GlassTabsPanel({ className, ...props }: React.ComponentProps<typeof BaseTabs.Panel>) {
  return <BaseTabs.Panel className={cn('mt-4 outline-none', className)} {...props} />;
}

export { GlassTabs, GlassTabsList, GlassTabsTab, GlassTabsPanel };
