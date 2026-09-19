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
 * - The labels bend only while the pill moves. The displacement swells from zero and
 *   back over a slide, so at rest they're geometrically untouched and read as crisp
 *   as the rest of the page. The filter stays mounted the whole time: taking it off
 *   and on would change how the row is rasterised, and the labels would look bolder
 *   for the length of every switch.
 * - The pill and the lens move on one clock, a single tween, rather than a CSS
 *   transition followed frame by frame. The two start a frame apart otherwise, and
 *   on an overshooting curve the lens ran ~18px ahead of the pill early in a slide.
 * - The pill can be dragged: press the active tab and slide. It follows the pointer
 *   with the glass bending what passes under it, gives a little past either end, and
 *   on release snaps to the nearest tab (a flick carries it a little further) and
 *   selects it.
 * - A tab can carry an icon and an accent (`color`) for it. The pill stays neutral,
 *   so a coloured icon reads the same under it as beside it.
 * - `fit="equal"` splits the width evenly (labels of a kind); `fit="auto"` sizes each
 *   tab to its label, and the pill and lens take the new tab's width as they go. A
 *   list wider than its container scrolls inside its own frame.
 * - Panels of different sizes move the tabs around them as they switch. Put them in
 *   GlassTabsPanels and the box is the largest panel's.
 *
 *   <GlassTabs defaultValue="all">
 *     <GlassTabsList fit="auto">
 *       <GlassTabsTab value="all" icon={<LayoutGrid />} color="#e0922f">All</GlassTabsTab>
 *       <GlassTabsTab value="comics" icon={<Brush />} color="#5aa9ff">Comics</GlassTabsTab>
 *     </GlassTabsList>
 *     <GlassTabsPanels>
 *       <GlassTabsPanel value="all">…</GlassTabsPanel>
 *       <GlassTabsPanel value="comics">…</GlassTabsPanel>
 *     </GlassTabsPanels>
 *   </GlassTabs>
 */

const GlassTabs = BaseTabs.Root;

// Settles with a slight overshoot, the way a physical switch lands.
const SLIDE_EASE = cubicBezier(0.34, 1.35, 0.5, 1);
const SLIDE_MS = 300;
// Pointer travel before a press on the active tab becomes a drag, so a click stays a click.
const DRAG_SLOP = 4;
// How far past either end the pill follows the pointer: this share of the overshoot.
const EDGE_GIVE = 0.3;
// A flick lands where the pill would be this many ms later at its release speed,
// measured over the last FLICK_WINDOW ms of the drag and capped at FLICK_CAP of a tab.
const FLICK_MS = 120;
const FLICK_WINDOW = 100;
const FLICK_CAP = 0.6;

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

    // Boxes in the label row's own px. Layout offsets rather than rects, so a transform
    // above the control (a dialog scaling in) can't skew what the lens is baked to. The
    // row is positioned, so it's every tab's offset parent.
    const tabs = () =>
      [...labels.querySelectorAll<HTMLElement>('[role="tab"]')].filter(
        (tab) => !tab.hasAttribute('data-disabled'),
      );
    const activeTab = () => labels.querySelector<HTMLElement>('[role="tab"][data-active]');
    const boxOf = (tab: HTMLElement): Box => ({
      x: tab.offsetLeft,
      y: tab.offsetTop,
      w: tab.offsetWidth,
      h: tab.offsetHeight,
    });

    let lens: ReturnType<typeof mountGlassLens> | null = null;
    let lensW = 0;
    let lensH = 0;
    let at: Box | null = null;
    // How far the labels are bent right now, 0–1, so a snap can take it down from
    // wherever a drag left it.
    let bend = 0;
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
        lensW = b.w;
        lensH = b.h;
        lens.setActive(true);
        lens.setDisplScale(0);
      } catch {
        lens = null;
      }
    };
    // Re-baking the map is too dear per frame, so the lens only takes a new width
    // at a tab boundary; in between it stays centred on the pill.
    const sizeLens = (w: number, h: number) => {
      if (!lens || (w === lensW && h === lensH)) return;
      lens.setSize(w, h);
      lensW = w;
      lensH = h;
    };
    const setBend = (v: number) => {
      bend = v;
      lens?.setDisplScale(v);
    };

    // One writer for the pill and the lens, from the same numbers. The pill sits in
    // the list; the lens and the tabs in the row, which the list's padding offsets.
    const place = (b: Box) => {
      at = b;
      pill.style.width = `${b.w}px`;
      pill.style.height = `${b.h}px`;
      pill.style.transform = `translate(${labels.offsetLeft + b.x}px, ${labels.offsetTop + b.y}px)`;
      lens?.setPos(b.x + (b.w - lensW) / 2, b.y);
    };

    const jump = (tab: HTMLElement) => {
      cancelAnimationFrame(raf);
      const b = boxOf(tab);
      ensureLens(b);
      sizeLens(b.w, b.h);
      place(b);
      setBend(0);
      list.dataset.measured = '';
    };

    const slide = (tab: HTMLElement) => {
      const to = boxOf(tab);
      if (!at || reduced.matches) return jump(tab);
      cancelAnimationFrame(raf);
      ensureLens(to);
      // The lens takes the destination width up front: the only frames where the
      // difference could show are the ones where the displacement is bending the
      // labels anyway.
      sizeLens(to.w, to.h);
      const from = at;
      const bentFrom = bend;
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
        // Zero at both ends and full in the middle, so the glass has no edge to be
        // caught at; out of a drag it starts from the drag's bend and eases off.
        setBend(k < 1 ? Math.max(Math.sin(Math.PI * k), bentFrom * (1 - e)) : 0);
        if (k < 1) raf = requestAnimationFrame(step);
        else place(to);
      };
      raf = requestAnimationFrame(step);
    };

    // ---- Dragging the pill ----
    //
    // The pill is placed by its centre: between two tabs it takes a width between
    // theirs, so under `fit="auto"` it grows and shrinks as it crosses the row.
    let drag: {
      id: number;
      x0: number;
      from: number;
      scale: number;
      moved: boolean;
      /** Recent pointer positions, for the release speed. */
      trail: { t: number; x: number }[];
    } | null = null;

    const boxAtCentre = (cx: number): { box: Box; nearest: HTMLElement } | null => {
      const all = tabs();
      if (!all.length) return null;
      const boxes = all.map(boxOf);
      const centres = boxes.map((b) => b.x + b.w / 2);
      const first = centres[0] ?? 0;
      const last = centres[centres.length - 1] ?? 0;
      // Some give past the ends, then it holds.
      const c =
        cx < first
          ? first - (first - cx) * EDGE_GIVE
          : cx > last
            ? last + (cx - last) * EDGE_GIVE
            : cx;
      let i = 0;
      while (i < centres.length - 2 && c > (centres[i + 1] ?? 0)) i += 1;
      const a = boxes[i] ?? boxes[0]!;
      const b = boxes[Math.min(i + 1, boxes.length - 1)] ?? a;
      const ca = centres[i] ?? first;
      const cb = centres[Math.min(i + 1, centres.length - 1)] ?? ca;
      const t = cb === ca ? 0 : Math.min(1, Math.max(0, (c - ca) / (cb - ca)));
      const w = a.w + (b.w - a.w) * t;
      let nearest = 0;
      centres.forEach((centre, j) => {
        if (Math.abs(centre - c) < Math.abs((centres[nearest] ?? 0) - c)) nearest = j;
      });
      return {
        box: { x: c - w / 2, y: a.y + (b.y - a.y) * t, w, h: a.h + (b.h - a.h) * t },
        nearest: all[nearest]!,
      };
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !at) return;
      const tab = e.target instanceof Element ? e.target.closest('[role="tab"]') : null;
      if (!tab || tab !== activeTab()) return;
      const rect = labels.getBoundingClientRect();
      drag = {
        id: e.pointerId,
        x0: e.clientX,
        from: at.x + at.w / 2,
        // Screen px per row px, so the pill tracks the pointer under a transform too.
        scale: labels.offsetWidth ? rect.width / labels.offsetWidth : 1,
        moved: false,
        trail: [{ t: e.timeStamp, x: e.clientX }],
      };
    };

    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = (e.clientX - drag.x0) / drag.scale;
      if (!drag.moved) {
        if (Math.abs(dx) < DRAG_SLOP) return;
        drag.moved = true;
        labels.setPointerCapture(e.pointerId);
        cancelAnimationFrame(raf);
        list.dataset.dragging = '';
      }
      drag.trail.push({ t: e.timeStamp, x: e.clientX });
      while (drag.trail.length > 2 && e.timeStamp - (drag.trail[0]?.t ?? 0) > FLICK_WINDOW)
        drag.trail.shift();
      const hit = boxAtCentre(drag.from + dx);
      if (!hit) return;
      sizeLens(Math.round(boxOf(hit.nearest).w), Math.round(hit.box.h));
      place(hit.box);
      if (!reduced.matches) setBend(Math.min(1, bend + 0.2));
    };

    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const done = drag;
      drag = null;
      if (!done.moved) return; // a plain press: Base UI takes the click
      delete list.dataset.dragging;
      if (labels.hasPointerCapture(e.pointerId)) labels.releasePointerCapture(e.pointerId);
      // The release speed, over the drag's last moments. A pointer that stopped before
      // letting go isn't flicking. The span is floored at a frame, so two events a
      // hair apart can't read as a flick, and the throw is capped short of a tab.
      const trail = done.trail.filter((p) => e.timeStamp - p.t <= FLICK_WINDOW);
      const a = trail[0];
      const b = trail[trail.length - 1];
      let throwX = 0;
      if (a && b && b !== a && e.timeStamp - b.t < 50) {
        const v = (b.x - a.x) / done.scale / Math.max(16, b.t - a.t);
        const all = tabs();
        const cap = all.length ? (FLICK_CAP * labels.offsetWidth) / all.length : 0;
        throwX = Math.max(-cap, Math.min(cap, v * FLICK_MS));
      }
      const cx = (at ? at.x + at.w / 2 : done.from) + throwX;
      const target = boxAtCentre(cx)?.nearest;
      if (!target) return;
      // A new tab goes through Base UI like any click, and the mark it moves brings
      // the pill home (the observer below); the same tab snaps back from here.
      if (target === activeTab()) slide(target);
      else target.click();
    };

    labels.addEventListener('pointerdown', onDown);
    labels.addEventListener('pointermove', onMove);
    labels.addEventListener('pointerup', onUp);
    labels.addEventListener('pointercancel', onUp);

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
    // row's own box. A drag in progress keeps its pill.
    const ro = new ResizeObserver(() => {
      const tab = activeTab();
      if (tab && !drag?.moved) jump(tab);
    });
    ro.observe(list);
    ro.observe(labels);

    return () => {
      cancelAnimationFrame(raf);
      labels.removeEventListener('pointerdown', onDown);
      labels.removeEventListener('pointermove', onMove);
      labels.removeEventListener('pointerup', onUp);
      labels.removeEventListener('pointercancel', onUp);
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
      {/* Chrome only: rim, shadow and a neutral fill (--glass-tabs-pill to restyle).
          The refraction is the filter on the row above, so this sits over the label,
          not behind it. Held back until the script has placed it on a measured box. */}
      <div
        ref={pillRef}
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute top-0 left-0 z-10 rounded-full opacity-0',
          'group-data-[measured]/tabs:opacity-100',
          'bg-[var(--glass-tabs-pill,rgb(255_255_255/7%))]',
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
  /** The icon's colour. */
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
        // The active tab is the pill's handle. It lets a vertical swipe scroll the page
        // and keeps a sideways one for the drag; the others leave a sideways swipe to
        // scroll a list that has outgrown its frame.
        'data-[active]:cursor-grab data-[active]:touch-pan-y group-data-[dragging]/tabs:cursor-grabbing',
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

// Set by GlassTabsPanels: its panels stay mounted and stack in one cell.
const Stacked = React.createContext(false);

function GlassTabsPanel({
  className,
  keepMounted,
  render,
  ...props
}: React.ComponentProps<typeof BaseTabs.Panel>) {
  const stacked = React.useContext(Stacked);
  return (
    <BaseTabs.Panel
      className={cn('mt-4 outline-none', className)}
      keepMounted={stacked || keepMounted}
      // Stacked, a hidden panel keeps its box so the stack keeps its size. It can't
      // wear `hidden`: Tailwind's preflight makes that `display: none !important` in
      // its base layer, and an important rule in an earlier layer beats any later one.
      // It's `inert` either way, and GlassTabsPanels hides it by `data-hidden`.
      render={stacked ? ({ hidden: _hidden, ...rest }) => <div {...rest} /> : render}
      {...props}
    />
  );
}

/**
 * Holds the panels in one grid cell, so the tabs' box is the largest panel's whatever
 * is showing and switching moves nothing around it. The hidden panels keep their
 * space, out of sight, out of the accessibility tree and out of the tab order.
 */
function GlassTabsPanels({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <Stacked.Provider value={true}>
      <div
        className={cn('grid *:[grid-area:1/1] [&>[data-hidden]]:invisible', className)}
        {...props}
      />
    </Stacked.Provider>
  );
}

export { GlassTabs, GlassTabsList, GlassTabsTab, GlassTabsPanel, GlassTabsPanels };
