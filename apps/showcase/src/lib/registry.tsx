import { useState, type FC } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AppWindow,
  Aperture,
  Menu,
  MousePointerClick,
  PanelTop,
  QrCode,
  SlidersHorizontal,
  Square,
  SquareStack,
  Star,
  ToggleRight,
  Type,
  Waves,
} from 'lucide-react'
import { GlassSurface } from '@/components/liquid-glass/glass-surface'
import { GlassCard } from '@/components/liquid-glass/glass-card'
import {
  GlassDialog,
  GlassDialogTrigger,
  GlassDialogContent,
  GlassDialogHeader,
  GlassDialogTitle,
  GlassDialogDescription,
  GlassDialogFooter,
  GlassDialogClose,
} from '@/components/liquid-glass/glass-dialog'
import {
  GlassTabs,
  GlassTabsList,
  GlassTabsTab,
  GlassTabsPanel,
} from '@/components/liquid-glass/glass-tabs'
import { GlassSwitch } from '@/components/liquid-glass/glass-switch'
import { GlassSlider } from '@/components/liquid-glass/glass-slider'
import {
  GlassDropdownMenu,
  GlassDropdownMenuTrigger,
  GlassDropdownMenuContent,
  GlassDropdownMenuItem,
  GlassDropdownMenuSeparator,
} from '@/components/liquid-glass/glass-dropdown-menu'
import { GlassText, GlassShape, GlassLens, GlassButton, GlassRipple } from '@liquidglassjs/react'
import { GlassQR } from '@liquidglassjs/qr/react'

/** Where the registry JSON is hosted (served from the showcase's own deploy). */
export const REGISTRY_URL = 'https://amir-abushanab.github.io/liquid-glass'

export type Category = 'Components' | 'Effects'

/** One tunable glass parameter — drives a slider in the preview's Tuner. */
export type TuneParam = {
  key: string
  label?: string
  min: number
  max: number
  step: number
  default: number
}

/** A component's live-tuning config: which params to expose + how to regenerate the snippet. */
export interface TuneConfig {
  params: TuneParam[]
  /** Build the copy-pastable snippet from the current values. */
  code: (v: Record<string, number>) => string
  /**
   * Browser capability the glass needs before these params have any visible
   * effect. Frost shells refract via `backdrop-filter: url()` (Chromium only —
   * elsewhere they fall back to a plain blur that ignores every refraction
   * param); the QR runs a WebGL2 shader. Where the capability is missing the
   * Tuner disables its sliders with a note instead of silently doing nothing.
   * Omit for the SVG-filter paths (text/shape/lens/button/ripple, slider/switch),
   * which honor every param in every browser.
   */
  needs?: 'backdrop-url' | 'webgl2'
}

/** Default value for each tunable param, e.g. `{ strength: 11, … }`. */
export const tuneDefaults = (t: TuneConfig): Record<string, number> =>
  Object.fromEntries(t.params.map((p) => [p.key, p.default]))

export type RenderPath = 'svg' | 'webgl' | 'frost'

/**
 * Which render path a preview's glass runs on — the same taxonomy as the
 * showcase's render-path chips. Derived from `needs` so the two can't drift:
 * backdrop-url *is* the frost path's refract mechanism, webgl2 is the shader
 * path, and everything else here rides the works-everywhere SVG filter.
 */
export const renderPathOf = (t: TuneConfig): RenderPath =>
  t.needs === 'backdrop-url' ? 'frost' : t.needs === 'webgl2' ? 'webgl' : 'svg'

export interface RegistryItem {
  slug: string
  title: string
  category: Category
  /** Sidebar / card glyph. */
  icon: LucideIcon
  /** One-line summary shown under the title. */
  description: string
  /** npm package for effect bindings; omit for shadcn-registry shells. */
  npm?: string
  /** The usage snippet shown in the Code tab (untuned default; tuned items regenerate it via `tune.code`). */
  code: string
  /** The live preview. Receives the current tuned `values` (undefined/empty for untuned items). */
  Demo: FC<{ values?: Record<string, number> }>
  /** When set, the preview shows a live parameter tuner and shareable URL state. */
  tune?: TuneConfig
}

const triggerClass =
  'rounded-full bg-white/15 px-5 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/25'

/** The dark, grid-lined pane the ripple bends — same look as the showcase button. */
const ripplePane =
  'radial-gradient(90% 130% at 50% 0%, rgba(123,60,255,0.55), transparent 62%),' +
  'repeating-linear-gradient(0deg, rgb(255 255 255 / 5%) 0 1px, transparent 1px 20px),' +
  'repeating-linear-gradient(90deg, rgb(255 255 255 / 5%) 0 1px, transparent 1px 20px),' +
  'linear-gradient(180deg, #17131f, #0a0813)'

/** The aurora gradient the brand droplet is filled with. */
const dropletFill = 'M32 4 C 46 22 52 30 52 40 A 20 20 0 1 1 12 40 C 12 30 18 22 32 4 Z'

/** Chips that morph the Glass Button label — mirrors the showcase "content morph". */
const morphLabels = ['Download', 'Play', 'Pause', 'Search', '🎉 Ship it', 'v2.4.1']

const swatches = ['#8a7bff', '#39d1f9', '#ffb400', '#ff5ca8', '#5ce0a8', '#8a7bff', '#39d1f9', '#ffb400', '#ff5ca8']

// ── Live-tuning configs: the params each preview's Tuner exposes, and how the
//    tuned values regenerate the copy-pastable snippet. ─────────────────────────
const SHAPE_TUNE: TuneConfig = {
  params: [
    { key: 'strength', min: 0, max: 40, step: 0.5, default: 11 },
    { key: 'chroma', min: 0, max: 1.5, step: 0.02, default: 0.35 },
    { key: 'dome', min: 0, max: 30, step: 0.5, default: 6 },
    { key: 'depth', min: 0, max: 30, step: 0.5, default: 6 },
    { key: 'edge', min: 0, max: 2, step: 0.05, default: 1 },
    { key: 'glow', min: 0, max: 2, step: 0.05, default: 0.4 },
  ],
  code: (v) => `import { GlassShape } from "@liquidglassjs/react"

export function Example() {
  return (
    <GlassShape strength={${v.strength}} chroma={${v.chroma}} dome={${v.dome}} depth={${v.depth}} edge={${v.edge}} glow={${v.glow}}>
      <svg width="140" height="140" viewBox="0 0 64 64">
        <path fill="#8b6bff" d="M32 4 C 46 22 52 30 52 40 A 20 20 0 1 1 12 40 C 12 30 18 22 32 4 Z" />
      </svg>
    </GlassShape>
  )
}`,
}

const LENS_TUNE: TuneConfig = {
  params: [
    { key: 'strength', min: 0, max: 40, step: 0.5, default: 18 },
    { key: 'chroma', min: 0, max: 1.5, step: 0.02, default: 0.14 },
    { key: 'dome', min: 0, max: 30, step: 0.5, default: 10 },
    { key: 'depth', min: 0, max: 30, step: 0.5, default: 6 },
    { key: 'edge', min: 0, max: 2, step: 0.05, default: 0.9 },
    { key: 'glow', min: 0, max: 2, step: 0.05, default: 0.32 },
  ],
  code: (v) => `import { GlassLens } from "@liquidglassjs/react"

export function Example() {
  return (
    <GlassLens
      width={150}
      height={150}
      radius={60}
      strength={${v.strength}}
      chroma={${v.chroma}}
      dome={${v.dome}}
      depth={${v.depth}}
      edge={${v.edge}}
      glow={${v.glow}}
      glint="#ffd9a0"
      className="h-[280px] w-full max-w-[560px] overflow-hidden rounded-xl"
    >
      <div className="relative h-full w-full bg-zinc-950 text-white">
        {/* live content — refracted under the lens */}
      </div>
    </GlassLens>
  )
}`,
}

const TEXT_TUNE: TuneConfig = {
  params: [
    { key: 'strength', min: 0, max: 20, step: 0.5, default: 8 },
    { key: 'chroma', min: 0, max: 1, step: 0.02, default: 0.4 },
    { key: 'bevel', min: 0.5, max: 10, step: 0.1, default: 2.5 },
    { key: 'dome', min: 0, max: 12, step: 0.5, default: 4 },
    { key: 'edge', min: 0, max: 1.5, step: 0.05, default: 0.9 },
    { key: 'glow', min: 0, max: 1, step: 0.05, default: 0.35 },
  ],
  code: (v) => `import { GlassText } from "@liquidglassjs/react"

export function Example() {
  return (
    <GlassText
      strength={${v.strength}}
      chroma={${v.chroma}}
      bevel={${v.bevel}}
      dome={${v.dome}}
      edge={${v.edge}}
      glow={${v.glow}}
      className="text-6xl font-black text-white"
    >
      Refraction
    </GlassText>
  )
}`,
}

const SURFACE_TUNE: TuneConfig = {
  needs: 'backdrop-url',
  params: [
    { key: 'strength', min: 0, max: 40, step: 0.5, default: 16 },
    { key: 'chroma', min: 0, max: 1.5, step: 0.02, default: 0.4 },
    { key: 'dome', min: 0, max: 30, step: 0.5, default: 12 },
    { key: 'depth', min: 0, max: 30, step: 0.5, default: 10 },
    { key: 'edge', min: 0, max: 2, step: 0.05, default: 0.9 },
    { key: 'glow', min: 0, max: 2, step: 0.05, default: 0.3 },
  ],
  code: (v) => `import { GlassSurface } from "@/components/liquid-glass/glass-surface"

export function Example() {
  return (
    <GlassSurface
      strength={${v.strength}}
      chroma={${v.chroma}}
      dome={${v.dome}}
      depth={${v.depth}}
      edge={${v.edge}}
      glow={${v.glow}}
      className="max-w-xs p-6"
    >
      <h2 className="text-lg font-semibold text-white">Glass surface</h2>
      <p className="mt-1 text-sm text-white/75">Content over refracting glass.</p>
    </GlassSurface>
  )
}`,
}

const CARD_TUNE: TuneConfig = {
  needs: 'backdrop-url',
  params: SURFACE_TUNE.params,
  code: (v) => `import { GlassCard } from "@/components/liquid-glass/glass-card"

export function Example() {
  return (
    <GlassCard
      strength={${v.strength}}
      chroma={${v.chroma}}
      dome={${v.dome}}
      depth={${v.depth}}
      edge={${v.edge}}
      glow={${v.glow}}
      className="max-w-xs"
    >
      <h2 className="text-lg font-semibold text-white">Glass card</h2>
      <p className="mt-1 text-sm text-white/75">glass-surface + a border + a shadow.</p>
    </GlassCard>
  )
}`,
}

const BUTTON_TUNE: TuneConfig = {
  params: [
    { key: 'strength', min: 0, max: 40, step: 0.5, default: 18 },
    { key: 'chroma', min: 0, max: 1.5, step: 0.02, default: 0.42 },
    { key: 'dome', min: 0, max: 30, step: 0.5, default: 13 },
    { key: 'edge', min: 0, max: 2, step: 0.05, default: 0.9 },
    { key: 'glow', min: 0, max: 2, step: 0.05, default: 0.3 },
    { key: 'radius', min: 0, max: 40, step: 1, default: 16 },
  ],
  code: (v) => `import { GlassButton } from "@liquidglassjs/react"

export function Example() {
  return (
    <GlassButton
      strength={${v.strength}}
      chroma={${v.chroma}}
      dome={${v.dome}}
      edge={${v.edge}}
      glow={${v.glow}}
      radius={${v.radius}}
      className="h-12 rounded-2xl px-6 font-semibold text-white"
    >
      Download
    </GlassButton>
  )
}`,
}

const RIPPLE_TUNE: TuneConfig = {
  params: [
    { key: 'strength', min: 0, max: 60, step: 1, default: 24 },
    { key: 'chroma', min: 0, max: 1.5, step: 0.02, default: 0.4 },
    { key: 'spec', min: 0, max: 1.5, step: 0.02, default: 0.7 },
    { key: 'blur', min: 0, max: 3, step: 0.05, default: 0.4 },
    { key: 'maxFrac', label: 'reach', min: 0.2, max: 1.5, step: 0.02, default: 0.85 },
  ],
  code: (v) => `import { GlassRipple } from "@liquidglassjs/react"

export function Example() {
  return (
    <GlassRipple
      strength={${v.strength}}
      chroma={${v.chroma}}
      spec={${v.spec}}
      blur={${v.blur}}
      maxFrac={${v.maxFrac}}
      className="h-[60px] w-56 rounded-[18px] font-semibold text-white"
    >
      npm i liquid-glass →
    </GlassRipple>
  )
}`,
}

const QR_TUNE: TuneConfig = {
  needs: 'webgl2',
  params: [
    { key: 'scaleX', min: 0, max: 0.25, step: 0.005, default: 0.08 },
    { key: 'scaleY', min: 0, max: 0.25, step: 0.005, default: 0.08 },
    { key: 'chromaAmount', label: 'chroma', min: 0, max: 3, step: 0.05, default: 1 },
    { key: 'lensDepth', label: 'depth', min: 0, max: 80, step: 1, default: 30 },
  ],
  code: (v) => `import { GlassQR } from "@liquidglassjs/qr/react"

export function Example() {
  return (
    <GlassQR
      value="https://liquidglassjs.dev"
      size={220}
      dotColor="#f6f6f6"
      backgroundColor="#0a0a0a"
      scaleX={${v.scaleX}}
      scaleY={${v.scaleY}}
      chromaAmount={${v.chromaAmount}}
      lensDepth={${v.lensDepth}}
      className="rounded-2xl"
    />
  )
}`,
}

// Frost shells (tabs/dialog/dropdown) share one param set; the glass is subtle and
// only shows when the panel/pill is visible, so tune, then open/hover to preview.
const FROST_PARAMS: TuneParam[] = [
  { key: 'strength', min: 0, max: 40, step: 0.5, default: 12 },
  { key: 'chroma', min: 0, max: 1.5, step: 0.02, default: 0.4 },
  { key: 'dome', min: 0, max: 30, step: 0.5, default: 10 },
  { key: 'depth', min: 0, max: 30, step: 0.5, default: 8 },
  { key: 'edge', min: 0, max: 2, step: 0.05, default: 0.9 },
  { key: 'glow', min: 0, max: 2, step: 0.05, default: 0.3 },
]

const TABS_TUNE: TuneConfig = {
  needs: 'backdrop-url',
  params: FROST_PARAMS,
  code: (v) => `import {
  GlassTabs, GlassTabsList, GlassTabsTab, GlassTabsPanel,
} from "@/components/liquid-glass/glass-tabs"

export function Example() {
  return (
    <GlassTabs defaultValue="overview">
      <GlassTabsList strength={${v.strength}} chroma={${v.chroma}} dome={${v.dome}} depth={${v.depth}} edge={${v.edge}} glow={${v.glow}}>
        <GlassTabsTab value="overview">Overview</GlassTabsTab>
        <GlassTabsTab value="activity">Activity</GlassTabsTab>
        <GlassTabsTab value="settings">Settings</GlassTabsTab>
      </GlassTabsList>
    </GlassTabs>
  )
}`,
}

const DIALOG_TUNE: TuneConfig = {
  needs: 'backdrop-url',
  params: FROST_PARAMS,
  code: (v) => `import {
  GlassDialog, GlassDialogTrigger, GlassDialogContent,
  GlassDialogHeader, GlassDialogTitle, GlassDialogDescription,
} from "@/components/liquid-glass/glass-dialog"

export function Example() {
  return (
    <GlassDialog>
      <GlassDialogTrigger>Open dialog</GlassDialogTrigger>
      <GlassDialogContent strength={${v.strength}} chroma={${v.chroma}} dome={${v.dome}} depth={${v.depth}} edge={${v.edge}} glow={${v.glow}}>
        <GlassDialogHeader>
          <GlassDialogTitle>Delete project</GlassDialogTitle>
          <GlassDialogDescription>This can&apos;t be undone.</GlassDialogDescription>
        </GlassDialogHeader>
      </GlassDialogContent>
    </GlassDialog>
  )
}`,
}

const DROPDOWN_TUNE: TuneConfig = {
  needs: 'backdrop-url',
  params: FROST_PARAMS,
  code: (v) => `import {
  GlassDropdownMenu, GlassDropdownMenuTrigger, GlassDropdownMenuContent,
  GlassDropdownMenuItem, GlassDropdownMenuSeparator,
} from "@/components/liquid-glass/glass-dropdown-menu"

export function Example() {
  return (
    <GlassDropdownMenu>
      <GlassDropdownMenuTrigger>Options</GlassDropdownMenuTrigger>
      <GlassDropdownMenuContent strength={${v.strength}} chroma={${v.chroma}} dome={${v.dome}} depth={${v.depth}} edge={${v.edge}} glow={${v.glow}}>
        <GlassDropdownMenuItem>Profile</GlassDropdownMenuItem>
        <GlassDropdownMenuItem>Settings</GlassDropdownMenuItem>
        <GlassDropdownMenuSeparator />
        <GlassDropdownMenuItem>Sign out</GlassDropdownMenuItem>
      </GlassDropdownMenuContent>
    </GlassDropdownMenu>
  )
}`,
}

const SLIDER_TUNE: TuneConfig = {
  params: [
    { key: 'strength', min: 0, max: 40, step: 0.5, default: 11 },
    { key: 'chroma', min: 0, max: 1.5, step: 0.02, default: 0.32 },
    { key: 'dome', min: 0, max: 30, step: 0.5, default: 12 },
    { key: 'depth', min: 0, max: 30, step: 0.5, default: 8 },
    { key: 'edge', min: 0, max: 2, step: 0.05, default: 0.9 },
    { key: 'glow', min: 0, max: 2, step: 0.05, default: 0.3 },
  ],
  code: (v) => `import { GlassSlider } from "@/components/liquid-glass/glass-slider"

export function Example() {
  // Drag the thumb to see the rail refract through the glass.
  return (
    <GlassSlider defaultValue={40} strength={${v.strength}} chroma={${v.chroma}} dome={${v.dome}} depth={${v.depth}} edge={${v.edge}} glow={${v.glow}} className="w-80" />
  )
}`,
}

const SWITCH_TUNE: TuneConfig = {
  params: [
    { key: 'strength', min: 0, max: 40, step: 0.5, default: 14 },
    { key: 'chroma', min: 0, max: 1.5, step: 0.02, default: 0.4 },
    { key: 'dome', min: 0, max: 30, step: 0.5, default: 8 },
    { key: 'depth', min: 0, max: 30, step: 0.5, default: 5 },
    { key: 'edge', min: 0, max: 2, step: 0.05, default: 0.9 },
    { key: 'glow', min: 0, max: 2, step: 0.05, default: 0.32 },
  ],
  code: (v) => `import { GlassSwitch } from "@/components/liquid-glass/glass-switch"

export function Example() {
  // Press-and-hold to see the track refract through the glass thumb.
  return (
    <GlassSwitch defaultChecked strength={${v.strength}} chroma={${v.chroma}} dome={${v.dome}} depth={${v.depth}} edge={${v.edge}} glow={${v.glow}} />
  )
}`,
}

export const registry: RegistryItem[] = [
  // ── Components (registry shells) ─────────────────────────────────────────
  {
    slug: 'glass-surface',
    title: 'Glass Surface',
    category: 'Components',
    icon: Square,
    description:
      'The base primitive: crisp content over a glass surface that frosts the scene behind it, and refracts it on Chromium.',
    tune: SURFACE_TUNE,
    code: SURFACE_TUNE.code(tuneDefaults(SURFACE_TUNE)),
    Demo: ({ values: v = tuneDefaults(SURFACE_TUNE) }) => (
      <GlassSurface
        strength={v.strength}
        chroma={v.chroma}
        dome={v.dome}
        depth={v.depth}
        edge={v.edge}
        glow={v.glow}
        className="max-w-xs p-6"
      >
        <h2 className="text-lg font-semibold text-white">Glass surface</h2>
        <p className="mt-1 text-sm text-white/75">Content over refracting glass.</p>
      </GlassSurface>
    ),
  },
  {
    slug: 'glass-card',
    title: 'Glass Card',
    category: 'Components',
    icon: SquareStack,
    description: 'A glass surface with a border, padding, and an elevation shadow.',
    tune: CARD_TUNE,
    code: CARD_TUNE.code(tuneDefaults(CARD_TUNE)),
    Demo: ({ values: v = tuneDefaults(CARD_TUNE) }) => (
      <GlassCard
        strength={v.strength}
        chroma={v.chroma}
        dome={v.dome}
        depth={v.depth}
        edge={v.edge}
        glow={v.glow}
        className="max-w-xs"
      >
        <h2 className="text-lg font-semibold text-white">Glass card</h2>
        <p className="mt-1 text-sm text-white/75">glass-surface + a border + a shadow.</p>
      </GlassCard>
    ),
  },
  {
    slug: 'glass-dialog',
    title: 'Glass Dialog',
    category: 'Components',
    icon: AppWindow,
    description:
      'A modal dialog: Base UI behavior (focus trap, scroll lock, ARIA) with a frosted glass panel over a dimmed backdrop.',
    tune: DIALOG_TUNE,
    code: DIALOG_TUNE.code(tuneDefaults(DIALOG_TUNE)),
    Demo: ({ values: v = tuneDefaults(DIALOG_TUNE) }) => (
      <GlassDialog>
        <GlassDialogTrigger className={triggerClass}>Open dialog</GlassDialogTrigger>
        <GlassDialogContent
          strength={v.strength}
          chroma={v.chroma}
          dome={v.dome}
          depth={v.depth}
          edge={v.edge}
          glow={v.glow}
        >
          <GlassDialogHeader>
            <GlassDialogTitle>Delete project</GlassDialogTitle>
            <GlassDialogDescription>This can&apos;t be undone.</GlassDialogDescription>
          </GlassDialogHeader>
          <p className="mt-4 text-sm text-foreground/80">
            The panel refracts the page behind it on Chromium, and frosts it elsewhere.
          </p>
          <GlassDialogFooter>
            <GlassDialogClose className="rounded-md px-4 py-2 text-sm hover:bg-white/10">
              Cancel
            </GlassDialogClose>
          </GlassDialogFooter>
        </GlassDialogContent>
      </GlassDialog>
    ),
  },
  {
    slug: 'glass-tabs',
    title: 'Glass Tabs',
    category: 'Components',
    icon: PanelTop,
    description:
      'A segmented control: Base UI Tabs with a glass pill that slides under the active label and refracts it.',
    tune: TABS_TUNE,
    code: TABS_TUNE.code(tuneDefaults(TABS_TUNE)),
    Demo: ({ values: v = tuneDefaults(TABS_TUNE) }) => (
      <GlassTabs defaultValue="daily">
        <GlassTabsList
          strength={v.strength}
          chroma={v.chroma}
          dome={v.dome}
          depth={v.depth}
          edge={v.edge}
          glow={v.glow}
        >
          <GlassTabsTab value="daily">Daily</GlassTabsTab>
          <GlassTabsTab value="weekly">Weekly</GlassTabsTab>
          <GlassTabsTab value="monthly">Monthly</GlassTabsTab>
        </GlassTabsList>
        <GlassTabsPanel value="daily" className="text-center text-sm text-white/80">
          A glass pill marks the active range.
        </GlassTabsPanel>
        <GlassTabsPanel value="weekly" className="text-center text-sm text-white/80">
          …and refracts the label beneath it.
        </GlassTabsPanel>
        <GlassTabsPanel value="monthly" className="text-center text-sm text-white/80">
          Base UI drives roving focus + arrow keys.
        </GlassTabsPanel>
      </GlassTabs>
    ),
  },
  {
    slug: 'glass-switch',
    title: 'Glass Switch',
    category: 'Components',
    icon: ToggleRight,
    description:
      'A toggle: Base UI Switch with a real glass thumb. Press it and the track refracts through the glass, a live SVG lens rather than a CSS blur.',
    tune: SWITCH_TUNE,
    code: SWITCH_TUNE.code(tuneDefaults(SWITCH_TUNE)),
    Demo: ({ values: v = tuneDefaults(SWITCH_TUNE) }) => (
      <div className="flex items-center gap-4">
        <GlassSwitch defaultChecked strength={v.strength} chroma={v.chroma} dome={v.dome} depth={v.depth} edge={v.edge} glow={v.glow} />
        <GlassSwitch strength={v.strength} chroma={v.chroma} dome={v.dome} depth={v.depth} edge={v.edge} glow={v.glow} />
      </div>
    ),
  },
  {
    slug: 'glass-slider',
    title: 'Glass Slider',
    category: 'Components',
    icon: SlidersHorizontal,
    description:
      'A slider: Base UI Slider with a real glass thumb. Drag it and the rail refracts through the glass, a live SVG lens rather than a CSS blur.',
    tune: SLIDER_TUNE,
    code: SLIDER_TUNE.code(tuneDefaults(SLIDER_TUNE)),
    Demo: ({ values: v = tuneDefaults(SLIDER_TUNE) }) => (
      <GlassSlider
        defaultValue={40}
        strength={v.strength}
        chroma={v.chroma}
        dome={v.dome}
        depth={v.depth}
        edge={v.edge}
        glow={v.glow}
        className="w-80"
      />
    ),
  },
  {
    slug: 'glass-dropdown-menu',
    title: 'Glass Dropdown Menu',
    category: 'Components',
    icon: Menu,
    description:
      'A dropdown menu: Base UI Menu (anchored positioning, roving focus, typeahead) with a frosted glass popup.',
    tune: DROPDOWN_TUNE,
    code: DROPDOWN_TUNE.code(tuneDefaults(DROPDOWN_TUNE)),
    Demo: ({ values: v = tuneDefaults(DROPDOWN_TUNE) }) => (
      <GlassDropdownMenu>
        <GlassDropdownMenuTrigger className={triggerClass}>Options</GlassDropdownMenuTrigger>
        <GlassDropdownMenuContent
          strength={v.strength}
          chroma={v.chroma}
          dome={v.dome}
          depth={v.depth}
          edge={v.edge}
          glow={v.glow}
        >
          <GlassDropdownMenuItem>Profile</GlassDropdownMenuItem>
          <GlassDropdownMenuItem>Settings</GlassDropdownMenuItem>
          <GlassDropdownMenuItem>Appearance</GlassDropdownMenuItem>
          <GlassDropdownMenuSeparator />
          <GlassDropdownMenuItem>Sign out</GlassDropdownMenuItem>
        </GlassDropdownMenuContent>
      </GlassDropdownMenu>
    ),
  },

  // ── Effects (@liquidglassjs/react bindings) ──────────────────────────────
  {
    slug: 'glass-text',
    title: 'Glass Text',
    category: 'Effects',
    icon: Type,
    npm: '@liquidglassjs/react',
    description: 'Refract live text through the glyph-shaped glass filter.',
    tune: TEXT_TUNE,
    code: TEXT_TUNE.code(tuneDefaults(TEXT_TUNE)),
    Demo: ({ values: v = tuneDefaults(TEXT_TUNE) }) => (
      <GlassText
        strength={v.strength}
        chroma={v.chroma}
        bevel={v.bevel}
        dome={v.dome}
        edge={v.edge}
        glow={v.glow}
        className="text-6xl font-black tracking-tight text-white"
      >
        Refraction
      </GlassText>
    ),
  },
  {
    slug: 'glass-shape',
    title: 'Glass Shape',
    category: 'Effects',
    icon: Star,
    npm: '@liquidglassjs/react',
    description: 'Liquid glass clipped to any alpha source: an inline <svg>, <img>, or <canvas>.',
    tune: SHAPE_TUNE,
    code: SHAPE_TUNE.code(tuneDefaults(SHAPE_TUNE)),
    Demo: ({ values: v = tuneDefaults(SHAPE_TUNE) }) => (
      <GlassShape
        bevel={3.2}
        strength={v.strength}
        chroma={v.chroma}
        dome={v.dome}
        depth={v.depth}
        edge={v.edge}
        glow={v.glow}
      >
        <svg width="140" height="140" viewBox="0 0 64 64" aria-hidden="true">
          <defs>
            <linearGradient id="doc-drop" x1=".28" y1=".05" x2=".72" y2=".95">
              <stop stopColor="#5ad8ff" />
              <stop offset=".5" stopColor="#8b6bff" />
              <stop offset="1" stopColor="#ff4f9d" />
            </linearGradient>
          </defs>
          <path fill="url(#doc-drop)" d={dropletFill} />
        </svg>
      </GlassShape>
    ),
  },
  {
    slug: 'glass-lens',
    title: 'Glass Lens',
    category: 'Effects',
    icon: Aperture,
    npm: '@liquidglassjs/react',
    description: 'A movable refraction lens over live content; the text, grid, and chips beneath it bend in place.',
    tune: LENS_TUNE,
    code: LENS_TUNE.code(tuneDefaults(LENS_TUNE)),
    Demo: ({ values: v = tuneDefaults(LENS_TUNE) }) => (
      <GlassLens
        width={150}
        height={150}
        radius={60}
        strength={v.strength}
        chroma={v.chroma}
        dome={v.dome}
        depth={v.depth}
        edge={v.edge}
        glow={v.glow}
        blur={0}
        glint="#ffd9a0"
        className="w-full max-w-[560px] overflow-hidden rounded-xl ring-1 ring-white/10"
      >
        <div className="relative h-[280px] w-full overflow-hidden bg-zinc-950 text-white">
          <div className="absolute inset-0 [background:repeating-linear-gradient(0deg,rgb(255_255_255/6%)_0_1px,transparent_1px_22px),repeating-linear-gradient(90deg,rgb(255_255_255/6%)_0_1px,transparent_1px_22px)]" />
          <span className="absolute top-6 left-7 rounded border border-white/25 px-1.5 py-0.5 text-[10px] font-medium tracking-[0.2em] text-white/80 uppercase">
            LIQUID · GLASS
          </span>
          <h3 className="absolute top-14 left-7 text-lg font-semibold">Refraction Sample 04</h3>
          <p className="absolute top-[88px] left-7 text-[11px] text-white/50">move the lens over live DOM</p>
          <div className="absolute bottom-[60px] left-7 flex gap-1.5">
            {swatches.map((c, i) => (
              <i key={i} className="block h-[17px] w-[26px] rounded-[3px]" style={{ background: c }} />
            ))}
          </div>
          <div className="absolute bottom-6 left-7 font-mono text-xs text-white/60">
            00:24:18:06 · F/2.8 · ISO 320
          </div>
        </div>
      </GlassLens>
    ),
  },
  {
    slug: 'glass-button',
    title: 'Glass Button',
    category: 'Effects',
    icon: MousePointerClick,
    npm: '@liquidglassjs/react',
    description: 'Change a glass button’s label and it reshapes to fit, the refraction stretching through the morph.',
    tune: BUTTON_TUNE,
    code: BUTTON_TUNE.code(tuneDefaults(BUTTON_TUNE)),
    Demo: ({ values: v = tuneDefaults(BUTTON_TUNE) }) => {
      const [label, setLabel] = useState('Download')
      return (
        <div className="flex flex-col items-center gap-5">
          <GlassButton
            strength={v.strength}
            chroma={v.chroma}
            dome={v.dome}
            edge={v.edge}
            glow={v.glow}
            radius={v.radius}
            className="h-12 rounded-2xl px-6 font-semibold text-white"
          >
            {label}
          </GlassButton>
          <div className="flex flex-wrap justify-center gap-2">
            {morphLabels.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLabel(l)}
                className={
                  'rounded-full border px-3 py-1 text-xs backdrop-blur transition ' +
                  (l === label
                    ? 'border-white/40 bg-white/25 text-white'
                    : 'border-white/20 bg-white/10 text-white/80 hover:bg-white/20')
                }
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )
    },
  },
  {
    slug: 'glass-ripple',
    title: 'Glass Ripple',
    category: 'Effects',
    icon: Waves,
    npm: '@liquidglassjs/react',
    description: 'A press sends a refraction ripple out from that point, tinted with the palette. No WebGL.',
    tune: RIPPLE_TUNE,
    code: RIPPLE_TUNE.code(tuneDefaults(RIPPLE_TUNE)),
    Demo: ({ values: v = tuneDefaults(RIPPLE_TUNE) }) => (
      <GlassRipple
        strength={v.strength}
        chroma={v.chroma}
        spec={v.spec}
        blur={v.blur}
        maxFrac={v.maxFrac}
        pane={ripplePane}
        className="grid h-[60px] w-56 place-items-center rounded-[18px] text-[0.95rem] font-semibold text-white shadow-[0_16px_36px_-16px_rgb(0_0_0/0.6)]"
      >
        npm i liquid-glass →
      </GlassRipple>
    ),
  },
  {
    slug: 'glass-qr',
    title: 'Glass QR',
    category: 'Effects',
    icon: QrCode,
    npm: '@liquidglassjs/qr',
    description: 'A scannable QR rendered by a WebGL shader. Tap the centre for a refraction ripple.',
    tune: QR_TUNE,
    code: QR_TUNE.code(tuneDefaults(QR_TUNE)),
    Demo: ({ values: v = tuneDefaults(QR_TUNE) }) => (
      <GlassQR
        value="https://liquidglassjs.dev"
        size={220}
        dotColor="#f6f6f6"
        backgroundColor="#0a0a0a"
        scaleX={v.scaleX}
        scaleY={v.scaleY}
        chromaAmount={v.chromaAmount}
        lensDepth={v.lensDepth}
        className="rounded-2xl"
      />
    ),
  },
]

export const registryBySlug = new Map(registry.map((i) => [i.slug, i]))
export const categories: Category[] = ['Components', 'Effects']
