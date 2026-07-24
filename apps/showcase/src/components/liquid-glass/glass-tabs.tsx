'use client';

import * as React from 'react';
import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { LiquidGlass } from '@liquidglassjs/react';
import { cn } from '@/lib/utils';
import '@liquidglassjs/core/css';

/**
 * Liquid-glass Tabs — Base UI's Tabs (roving focus, keyboard nav, ARIA) with a
 * glass pill that slides under the active tab, frosting (and, on Chromium,
 * refracting) the scene behind it. Behavior is Base UI's; the glass is the skin.
 *
 * The pill is positioned by Base UI's `Tabs.Indicator` CSS variables. The tabs are
 * equal-width (grid auto-cols-fr), so the pill only *slides* — it never resizes —
 * which keeps the glass smooth (no per-frame filter rebuild).
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
  return (
    <BaseTabs.List
      className={cn(
        'relative isolate inline-grid auto-cols-fr grid-flow-col gap-1 rounded-full p-1 ring-1 ring-white/15',
        className,
      )}
      {...props}
    >
      {children}
      <BaseTabs.Indicator
        className={cn(
          'pointer-events-none absolute z-0 overflow-hidden rounded-full',
          'left-[var(--active-tab-left)] top-[var(--active-tab-top)]',
          'h-[var(--active-tab-height)] w-[var(--active-tab-width)]',
          'transition-[left,width] duration-300 ease-[cubic-bezier(0.34,1.4,0.5,1)]',
          'shadow-[inset_0_1px_0_rgb(255_255_255/40%),0_2px_10px_-2px_rgb(0_0_0/35%)]',
        )}
      >
        <LiquidGlass
          mode="frost"
          radius={999}
          strength={strength}
          chroma={chroma}
          dome={dome}
          depth={depth}
          edge={edge}
          glow={glow}
          className="pointer-events-none absolute inset-0"
        />
      </BaseTabs.Indicator>
    </BaseTabs.List>
  );
}

function GlassTabsTab({ className, ...props }: React.ComponentProps<typeof BaseTabs.Tab>) {
  return (
    <BaseTabs.Tab
      className={cn(
        'relative z-10 cursor-pointer rounded-full px-4 py-1.5 text-center text-sm font-medium outline-none transition-colors',
        'text-white/65 select-none data-[active]:text-white',
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
