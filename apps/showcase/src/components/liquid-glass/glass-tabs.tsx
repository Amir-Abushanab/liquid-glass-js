'use client';

import * as React from 'react';
import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { mountGlassLens, type MapProfile } from '@liquidglassjs/core';
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
 * - The labels bend only while the pill moves, and with its speed. The displacement
 *   swells from zero and back over a slide, so at rest they're geometrically untouched
 *   and read as crisp as the rest of the page. The filter stays mounted the whole
 *   time: taking it off and on would change how the row is rasterised, and the labels
 *   would look bolder for the length of every switch.
 * - The pill and the lens move on one clock, a spring stepped each frame, rather than
 *   a CSS transition followed frame by frame. The two start a frame apart otherwise,
 *   and on an overshooting curve the lens ran ~18px ahead of the pill early in a slide.
 * - The pill can be dragged: press the active tab and slide. It follows the pointer,
 *   gives a little past either end, and when let go carries on at the pointer's speed
 *   into the spring that lands it on a tab, which it selects. A slow release lands on
 *   the nearest tab, a flick on the next one along.
 * - A tab can carry an icon and an accent (`color`). The icon wears the accent in
 *   every state, and the glass takes a wash of it while it's over that tab.
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

// The pill's spring (stiffness and damping per unit mass). From rest it arrives in
// ~130ms, overshoots 4% and settles by ~260ms, the way a physical switch lands.
const SPRING_K = 625;
const SPRING_C = 35;
// Pointer travel before a press on the active tab becomes a drag, so a click stays a click.
const DRAG_SLOP = 4;
// Past either end the pill gives half the pointer's travel at first, stiffening until
// it's EDGE_GIVE px out, about where the frame's rounded end starts to cover it.
const EDGE_GIVE = 8;
// Let go, the pill lands on the tab nearest where it would coast to, slowing at
// FRICTION px/s², but at most one tab past where the throw began: a flick moves one
// tab, however hard. The throw is the pointer's last SPEED_WINDOW ms, its speed a
// straight-line fit to them, and none if the pointer stopped STOPPED_MS before letting
// go. The spring takes on as much of that speed as carries the pill no more than
// CARRY of a tab past where it lands.
const FRICTION = 3000;
const SPEED_WINDOW = 50;
const STOPPED_MS = 40;
const CARRY = 0.1;
// The labels bend fully from BEND_SPEED tabs/s, and by HELD_BEND while a pointer holds
// the pill still. The bend follows over ~BEND_EASE s, so over a switch it swells and
// ebbs, and a jittery pointer doesn't flicker the glass.
const BEND_SPEED = 6;
const HELD_BEND = 0.3;
const BEND_EASE = 0.05;

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
    // How far the labels are bent right now, 0–1.
    let bend = 0;

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
    // The glass takes a wash of the accent of the tab it's over, faded by the pill's
    // transition as it moves; a placement (the first paint, a resize) takes it at
    // once. A tab without one leaves the plain fill.
    let tinted: HTMLElement | null = null;
    const tint = (tab: HTMLElement | undefined, instant = false) => {
      if (!tab || tab === tinted) return;
      tinted = tab;
      const accent = getComputedStyle(tab).getPropertyValue('--glass-tab-accent').trim();
      if (instant) pill.style.transition = 'none';
      pill.style.setProperty('--glass-tabs-on', accent);
      if (!instant) return;
      void getComputedStyle(pill).backgroundColor; // commit it before the fade is back
      pill.style.transition = '';
    };

    // The enabled tabs by centre, and where the row sits in the list. Read at the top
    // of a frame, before the pill is written, so moving it never forces a layout.
    let stops: { tab: HTMLElement; box: Box; c: number }[] = [];
    let rowX = 0;
    let rowY = 0;
    const measure = () => {
      stops = tabs().map((tab) => {
        const box = boxOf(tab);
        return { tab, box, c: box.x + box.w / 2 };
      });
      rowX = labels.offsetLeft;
      rowY = labels.offsetTop;
    };
    // Tab to tab, in px.
    const pitch = () => {
      const a = stops[0];
      const z = stops[stops.length - 1];
      if (!a || !z) return 1;
      return stops.length > 1 ? (z.c - a.c) / (stops.length - 1) : a.box.w || 1;
    };
    const nearest = (c: number) => {
      let best = 0;
      stops.forEach((s, j) => {
        if (Math.abs(s.c - c) < Math.abs((stops[best]?.c ?? 0) - c)) best = j;
      });
      return best;
    };
    // Past the first or last tab, the give (EDGE_GIVE).
    const give = (c: number) => {
      const lo = stops[0]?.c ?? c;
      const hi = stops[stops.length - 1]?.c ?? c;
      const past = (over: number) => (EDGE_GIVE * over) / (2 * EDGE_GIVE + over);
      return c < lo ? lo - past(lo - c) : c > hi ? hi + past(c - hi) : c;
    };
    // The pill's box for a centre. Between two tabs it takes a width between theirs,
    // so under `fit="auto"` it grows and shrinks as it crosses the row.
    const boxAt = (c: number): Box => {
      let i = 0;
      while (i < stops.length - 2 && c > (stops[i + 1]?.c ?? 0)) i += 1;
      const a = stops[i]!;
      const b = stops[Math.min(i + 1, stops.length - 1)] ?? a;
      const t = b.c === a.c ? 0 : Math.min(1, Math.max(0, (c - a.c) / (b.c - a.c)));
      const w = a.box.w + (b.box.w - a.box.w) * t;
      return {
        x: c - w / 2,
        y: a.box.y + (b.box.y - a.box.y) * t,
        w,
        h: a.box.h + (b.box.h - a.box.h) * t,
      };
    };

    // One writer for the pill and the lens, from the same numbers. The pill sits in
    // the list; the lens and the tabs in the row, which the list's padding offsets.
    const place = (b: Box) => {
      pill.style.width = `${b.w}px`;
      pill.style.height = `${b.h}px`;
      pill.style.transform = `translate(${rowX + b.x}px, ${rowY + b.y}px)`;
      lens?.setPos(b.x + (b.w - lensW) / 2, b.y);
    };

    // ---- Motion ----
    //
    // One loop moves the pill, from one state: its centre on the row (`pos`, before the
    // give at the ends) and its speed (`vel`, px/s). While a pointer holds the pill it
    // sets the centre; otherwise the spring takes the pill to the active tab from
    // whatever speed it has. So a drag's throw carries on into the landing, and a
    // switch made mid-slide bends the slide rather than starting it over.
    let placed = false;
    let pos = 0;
    let vel = 0;
    let shown = 0; // the centre drawn last frame
    let last = 0;
    let raf = 0;
    let drag: {
      id: number;
      x0: number;
      scale: number;
      moved: boolean;
      from: number;
      /** Where the pointer puts the pill's centre, before the give at the ends. */
      to: number;
      /** The pointer's travel from where it went down, in row px, for its speed. */
      trail: { t: number; x: number }[];
    } | null = null;

    const jump = (tab: HTMLElement) => {
      cancelAnimationFrame(raf);
      raf = 0;
      measure();
      const b = boxOf(tab);
      ensureLens(b);
      sizeLens(b.w, b.h);
      pos = shown = b.x + b.w / 2;
      vel = 0;
      place(b);
      tint(tab, true);
      setBend(0);
      placed = true;
      list.dataset.measured = '';
    };

    const tick = (now: number) => {
      raf = 0;
      measure();
      const tab = activeTab();
      if (!tab || !stops.length) return;
      // Seconds since the last frame; a frame's worth on the first. A long gap (a tab in
      // the background) counts as a short one, rather than flinging the pill.
      const dt = last ? Math.min(0.05, Math.max(0.001, (now - last) / 1000)) : 1 / 60;
      last = now;
      const goal = boxOf(tab);
      const home = goal.x + goal.w / 2;
      if (drag?.moved) pos = drag.to;
      else if (reduced.matches) {
        pos = home;
        vel = 0;
      } else {
        // Semi-implicit Euler in 2ms steps: steady at this stiffness at any frame rate.
        for (let left = dt; left > 0; left -= 0.002) {
          const h = Math.min(0.002, left);
          vel += (SPRING_K * (home - pos) - SPRING_C * vel) * h;
          pos += vel * h;
        }
      }
      const c = give(pos);
      // The lens takes the width of the tab under a held pill, and of the tab a free
      // one is heading for, so it re-bakes only as those change.
      const sized = drag?.moved ? (stops[nearest(c)]?.box ?? goal) : goal;
      sizeLens(sized.w, sized.h);
      place(boxAt(c));
      tint(stops[nearest(c)]?.tab);
      const speed = Math.abs(c - shown) / dt;
      shown = c;
      const want = reduced.matches
        ? 0
        : Math.max(drag?.moved ? HELD_BEND : 0, Math.min(1, speed / (BEND_SPEED * pitch())));
      setBend(bend + (want - bend) * (1 - Math.exp(-dt / BEND_EASE)));
      // At rest: on the tab, still, and the labels crisp again.
      if (!drag?.moved && Math.abs(home - pos) < 0.05 && Math.abs(vel) < 3 && bend < 0.002) {
        pos = shown = home;
        vel = 0;
        place(goal);
        tint(tab);
        setBend(0);
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (raf) return;
      const tab = activeTab();
      if (tab) ensureLens(boxOf(tab));
      last = 0;
      raf = requestAnimationFrame(tick);
    };

    // ---- Dragging the pill ----

    // The throw as the pointer let go: its speed in row px/s, a straight-line fit to its
    // last SPEED_WINDOW ms, and its travel where that began. No speed if it had stopped
    // STOPPED_MS before letting go, or if the samples span less than a frame (synthetic
    // input can send a drag in one burst).
    const throwOf = (trail: { t: number; x: number }[], t: number) => {
      const recent = trail.filter((s) => t - s.t <= SPEED_WINDOW);
      const a = recent[0];
      const z = recent[recent.length - 1];
      if (!a || !z || t - z.t > STOPPED_MS || z.t - a.t < 8) return { v: 0, from: z?.x ?? 0 };
      const mt = recent.reduce((sum, s) => sum + s.t, 0) / recent.length;
      const mx = recent.reduce((sum, s) => sum + s.x, 0) / recent.length;
      let num = 0;
      let den = 0;
      for (const s of recent) {
        num += (s.t - mt) * (s.x - mx);
        den += (s.t - mt) ** 2;
      }
      return { v: den ? (num / den) * 1000 : 0, from: a.x };
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !placed) return;
      const tab = e.target instanceof Element ? e.target.closest('[role="tab"]') : null;
      if (!tab || tab !== activeTab()) return;
      const rect = labels.getBoundingClientRect();
      drag = {
        id: e.pointerId,
        x0: e.clientX,
        // Screen px per row px, so the pill tracks the pointer under a transform too.
        scale: labels.offsetWidth ? rect.width / labels.offsetWidth : 1,
        moved: false,
        from: 0,
        to: 0,
        trail: [{ t: e.timeStamp, x: 0 }],
      };
    };

    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = (e.clientX - drag.x0) / drag.scale;
      drag.trail.push({ t: e.timeStamp, x: dx });
      while (drag.trail.length > 2 && e.timeStamp - (drag.trail[0]?.t ?? 0) > SPEED_WINDOW)
        drag.trail.shift();
      if (!drag.moved) {
        if (Math.abs(dx) < DRAG_SLOP) return;
        drag.moved = true;
        labels.setPointerCapture(e.pointerId);
        list.dataset.dragging = '';
        // Taken up from wherever it is, mid-slide or not, as if held since the press.
        drag.from = pos;
        start();
      }
      drag.to = drag.from + dx;
    };

    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const done = drag;
      drag = null;
      if (!done.moved) return; // a plain press: Base UI takes the click
      delete list.dataset.dragging;
      if (labels.hasPointerCapture(e.pointerId)) labels.releasePointerCapture(e.pointerId);
      measure();
      pos = done.to;
      vel = 0;
      // A cancelled drag (the browser took the pointer back) just goes home.
      if (e.type === 'pointerup' && stops.length) {
        const { v, from } = throwOf(done.trail, e.timeStamp);
        const c = give(pos);
        const here = nearest(c);
        const began = nearest(give(done.from + from));
        const aim = nearest(c + (Math.sign(v) * v * v) / (2 * FRICTION));
        // One past where the throw began at most, and never back behind where it got to.
        const land =
          stops[
            v > 0
              ? Math.min(aim, Math.max(here, began + 1))
              : v < 0
                ? Math.max(aim, Math.min(here, began - 1))
                : here
          ];
        // The spring overshoots by about v/√K·0.45 from on the tab, less the further it
        // still has to go: so this much of the throw lands within CARRY of a tab.
        const ahead = land ? Math.max(0, (land.c - pos) * Math.sign(v)) : 0;
        const most = Math.sqrt(SPRING_K) * (2.25 * CARRY * pitch() + ahead);
        vel = Math.max(-most, Math.min(most, v));
        // A new tab goes through Base UI like any click. The spring heads for whatever
        // is active next frame, so a controlled value that refuses it sends the pill home.
        if (land && land.tab !== activeTab()) land.tab.click();
      }
      start();
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
      if (placed) start();
      else jump(next);
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
      {/* Chrome only: rim, shadow and a wash of the accent of the tab it's over, or a
          faint white where there's none (--glass-tabs-pill restyles the fill). The
          refraction is the filter on the row above, so this sits over the label, not
          behind it. Held back until the script has placed it on a measured box. */}
      <div
        ref={pillRef}
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute top-0 left-0 z-10 rounded-full opacity-0',
          'group-data-[measured]/tabs:opacity-100',
          'bg-[var(--glass-tabs-pill,color-mix(in_oklab,var(--glass-tabs-on,rgb(255_255_255/47%))_15%,transparent))] transition-[background-color] duration-200 motion-reduce:transition-none',
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
