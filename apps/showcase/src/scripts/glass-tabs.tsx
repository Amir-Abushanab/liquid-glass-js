// The showcase's segmented controls are the registry's GlassTabs, rendered into the
// static page: the demo's two rows (placeholders in body.html) and the hero's
// package-manager picker (install-command.js). The Glass Tuner's "Segmented" section
// drives all of them through one set of lens params (tuneGlassTabs).
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarDays, CalendarRange, Sun } from 'lucide-react';
import type { MapProfile } from '@liquidglassjs/core';
import { GlassTabs, GlassTabsList, GlassTabsTab } from '@/components/liquid-glass/glass-tabs';
import '../styles/glass-tabs.css';

export interface GlassTabsParams {
  strength: number;
  chroma: number;
  blur: number;
  dome: number;
  depth: number;
  edge: number;
  glow: number;
  shade: number;
  profile?: MapProfile;
}

/**
 * Tuned for controls this small: the labels bend only while the pill travels, and at
 * this size a strong bend smears them, so it's the dome's edge that should show.
 */
export const GLASS_TABS_DEFAULTS: GlassTabsParams = {
  strength: 1,
  chroma: 0.22,
  blur: 0,
  dome: 12,
  depth: 10,
  edge: 0.8,
  glow: 0.28,
  shade: 0,
};

let params: GlassTabsParams = GLASS_TABS_DEFAULTS;
const listeners = new Set<() => void>();

/** Re-render every glass-tabs on the page with these lens params. */
export function tuneGlassTabs(patch: Partial<GlassTabsParams>): void {
  params = { ...params, ...patch };
  listeners.forEach((listener) => listener());
}

const useParams = () =>
  React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => params,
  );

// The page's own tokens, so the controls follow its light and dark themes. Labels stay
// opaque colours: see GlassTabsTab on why an alpha comes back colour-shifted.
const FRAME = 'ring-[color:var(--line-strong)] bg-[var(--surface)]';
const TAB =
  'min-w-[92px] px-[22px] py-[11px] text-[0.875rem] leading-none text-[color:var(--muted)] data-[active]:text-[color:var(--ink)] focus-visible:ring-[color:var(--ink)]';
// Two short words need less room. GlassTabsTab runs its classes through
// tailwind-merge, so the later min-w wins.
const TAB_NARROW = `${TAB} min-w-[72px]`;

function RangeTabs() {
  const p = useParams();
  return (
    <GlassTabs defaultValue="daily">
      {/* data-glasslens: counted by the "Show render paths" overlay, like the demos. */}
      <GlassTabsList aria-label="Range" className={FRAME} data-glasslens="" {...p}>
        <GlassTabsTab value="daily" icon={<Sun />} color="#f5b041" className={TAB}>
          Daily
        </GlassTabsTab>
        <GlassTabsTab value="weekly" icon={<CalendarDays />} color="#5dade2" className={TAB}>
          Weekly
        </GlassTabsTab>
        <GlassTabsTab value="monthly" icon={<CalendarRange />} color="#bb8fce" className={TAB}>
          Monthly
        </GlassTabsTab>
      </GlassTabsList>
    </GlassTabs>
  );
}

function ModeTabs() {
  const p = useParams();
  return (
    <GlassTabs defaultValue="on">
      <GlassTabsList aria-label="Mode" className={FRAME} data-glasslens="" {...p}>
        <GlassTabsTab value="on" className={TAB_NARROW}>
          On
        </GlassTabsTab>
        <GlassTabsTab value="off" className={TAB_NARROW}>
          Off
        </GlassTabsTab>
      </GlassTabsList>
    </GlassTabs>
  );
}

const DEMOS: Record<string, () => React.JSX.Element> = { range: RangeTabs, mode: ModeTabs };
for (const el of document.querySelectorAll<HTMLElement>('[data-glass-tabs]')) {
  const Demo = DEMOS[el.dataset.glassTabs ?? ''];
  if (Demo) createRoot(el).render(<Demo />);
}

export interface PackageManager {
  id: string;
  /** The brand mark: one 24×24 path. */
  path: string;
}

const PM_TAB =
  'min-w-0 gap-[5px] px-[11px] py-[5px] font-mono text-[0.76rem] leading-none font-semibold text-[color:var(--muted)] hover:text-[color:var(--ink)] data-[active]:text-[color:var(--ink)] focus-visible:ring-[color:var(--ink)]';

/**
 * The hero's package-manager picker. `read` is the stored choice; `pick` stores a new
 * one. It follows a choice made elsewhere (another tab, a command block) on the
 * `pm-change` and `storage` events.
 */
export function renderPackageManagerTabs(
  el: HTMLElement,
  managers: PackageManager[],
  read: () => string,
  pick: (id: string) => void,
): void {
  function PackageManagerTabs() {
    const p = useParams();
    const [value, setValue] = React.useState(read);
    React.useEffect(() => {
      const sync = () => setValue(read());
      window.addEventListener('pm-change', sync);
      window.addEventListener('storage', sync);
      return () => {
        window.removeEventListener('pm-change', sync);
        window.removeEventListener('storage', sync);
      };
    }, []);
    return (
      <GlassTabs
        value={value}
        onValueChange={(next) => {
          setValue(String(next));
          pick(String(next));
        }}
      >
        {/* The frame is the hero pill's; the control's own stays out of it. */}
        <GlassTabsList aria-label="Package manager" className="ring-0" {...p}>
          {managers.map((m) => (
            <GlassTabsTab
              key={m.id}
              value={m.id}
              className={PM_TAB}
              icon={
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d={m.path} />
                </svg>
              }
            >
              <span className="pm__name">{m.id}</span>
            </GlassTabsTab>
          ))}
        </GlassTabsList>
      </GlassTabs>
    );
  }
  createRoot(el).render(<PackageManagerTabs />);
}
