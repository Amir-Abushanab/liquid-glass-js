'use client';

import * as React from 'react';
import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { mountGlassLens } from '@liquidglassjs/core';
import { cn } from '@/lib/utils';
import '@liquidglassjs/core/css';

/**
 * Liquid-glass Tabs — Base UI's Tabs (roving focus, keyboard nav, ARIA) with a
 * glass pill that slides over the active tab and refracts its label. Behavior is
 * Base UI's; the glass is the skin.
 *
 * The pill is a real lens (mountGlassLens) over the label row, not a frosted panel:
 * a panel with nothing behind it to filter falls back to a blur, which outside
 * Chromium is a plain white wash. Refracting the labels is also what the control is
 * actually for — you can read the active label bending under the glass.
 *
 * The pill is positioned by Base UI's `Tabs.Indicator` CSS variables. The tabs are
 * equal-width (grid auto-cols-fr), so the pill only *slides* — it never resizes —
 * which keeps the glass smooth: sliding is one attribute write, resizing rebuilds
 * the displacement map.
 *
 *   <GlassTabs defaultValue="overview">
 *     <GlassTabsList>
 *       <GlassTabsTab value="overview">Overview</GlassTabsTab>
 *       <GlassTabsTab value="activity">Activity</GlassTabsTab>
 *     </GlassTabsList>
 *     <GlassTabsPanel value="overview">…</GlassTabsPanel>
 *   </GlassTabs>
 */

const GlassTabs = BaseTabs.Root;

function GlassTabsList({
  className,
  children,
  strength = 12,
  chroma = 0.4,
  dome = 10,
  depth = 8,
  edge = 0.9,
  glow = 0.3,
  ...props
}: React.ComponentProps<typeof BaseTabs.List> & {
  strength?: number;
  chroma?: number;
  dome?: number;
  depth?: number;
  edge?: number;
  glow?: number;
}) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const labelsRef = React.useRef<HTMLDivElement>(null);
  const pillRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const list = listRef.current;
    const labels = labelsRef.current;
    const pill = pillRef.current;
    if (!list || !labels || !pill) return;

    const box = () => {
      const lr = labels.getBoundingClientRect();
      const pr = pill.getBoundingClientRect();
      return {
        x: Math.round(pr.left - lr.left),
        y: Math.round(pr.top - lr.top),
        w: Math.round(pr.width),
        h: Math.round(pr.height),
      };
    };

    // Base UI sets the indicator's --active-tab-* variables after it has measured the
    // tabs, so on the first frame the pill has no box at all. Mounting a lens to that
    // asks for a zero-sized displacement map, which throws. Wait for a real one.
    let lens: ReturnType<typeof mountGlassLens> | null = null;
    let mountRaf = 0;
    let disposed = false;

    const place = () => {
      if (!lens) return;
      const b = box();
      if (!b.w || !b.h) return;
      lens.setSize(b.w, b.h); // no-op unless the tabs actually change size
      lens.setPos(b.x, b.y);
    };

    const tryMount = () => {
      if (disposed) return;
      const b = box();
      if (!b.w || !b.h) {
        mountRaf = requestAnimationFrame(tryMount);
        return;
      }
      lens = mountGlassLens({
        target: labels,
        host: list,
        lensW: b.w,
        lensH: b.h,
        radius: b.h / 2,
        strength,
        chroma,
        dome,
        depth,
        edge,
        glow,
        blur: 0,
      });
      place();
    };
    tryMount();

    // The pill slides on a CSS transition of `left`, so follow it frame by frame while
    // that runs — the glass and the chrome have to travel together or the refraction
    // lags a pill-width behind. A transition of left/width promotes nothing, so this
    // stays clear of the Safari bug where a compositing layer sliding over a filtered
    // sibling leaves the strip it vacated unrepainted.
    let raf = 0;
    const follow = () => {
      place();
      raf = requestAnimationFrame(follow);
    };
    const start = () => {
      if (!raf) follow();
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      place();
    };
    pill.addEventListener('transitionrun', start);
    pill.addEventListener('transitionend', stop);
    pill.addEventListener('transitioncancel', stop);
    const ro = new ResizeObserver(place);
    ro.observe(list);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(mountRaf);
      pill.removeEventListener('transitionrun', start);
      pill.removeEventListener('transitionend', stop);
      pill.removeEventListener('transitioncancel', stop);
      ro.disconnect();
      lens?.dispose();
    };
    // re-mount the lens when the glass params change (so the Tuner is live)
  }, [strength, chroma, dome, depth, edge, glow]);

  return (
    <BaseTabs.List
      ref={listRef}
      className={cn(
        'relative isolate inline-block rounded-full p-1 ring-1 ring-white/15',
        className,
      )}
      {...props}
    >
      {/* The lens filters this row, so the labels are what bends. It sits at the
          padding-box origin, which keeps Base UI's --active-tab-* offsets correct. */}
      <div ref={labelsRef} className="inline-grid auto-cols-fr grid-flow-col gap-1">
        {children}
      </div>
      {/* Chrome only — rim and shadow. The refraction is the filter on the row above,
          so this sits over the label rather than behind it. */}
      <BaseTabs.Indicator
        ref={pillRef}
        className={cn(
          'pointer-events-none absolute z-10 rounded-full',
          'left-[var(--active-tab-left)] top-[var(--active-tab-top)]',
          'h-[var(--active-tab-height)] w-[var(--active-tab-width)]',
          'transition-[left,width] duration-300 ease-[cubic-bezier(0.34,1.4,0.5,1)]',
          'shadow-[inset_0_1px_0_rgb(255_255_255/40%),inset_0_0_0_1px_rgb(255_255_255/14%),0_2px_10px_-2px_rgb(0_0_0/35%)]',
        )}
      />
    </BaseTabs.List>
  );
}

function GlassTabsTab({ className, ...props }: React.ComponentProps<typeof BaseTabs.Tab>) {
  return (
    <BaseTabs.Tab
      className={cn(
        'relative z-0 cursor-pointer rounded-full px-4 py-1.5 text-center text-sm font-medium outline-none transition-colors',
        // Opaque, not `text-white/65`. These labels are inside the element the lens
        // filters, and the filter recombines three separately-displaced copies by
        // adding them; on a partly transparent pixel the alphas add too, so
        // translucent text comes back darker and colour-shifted (a warm cast on
        // white). Dim the label with an opaque colour instead of an alpha.
        'text-[#c2d2e6] select-none data-[active]:text-white',
        'focus-visible:ring-2 focus-visible:ring-white/50',
        className,
      )}
      {...props}
    />
  );
}

function GlassTabsPanel({ className, ...props }: React.ComponentProps<typeof BaseTabs.Panel>) {
  return <BaseTabs.Panel className={cn('mt-4 outline-none', className)} {...props} />;
}

export { GlassTabs, GlassTabsList, GlassTabsTab, GlassTabsPanel };
