import { useEffect, useRef, useState, type FC } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AppWindow,
  Aperture,
  Combine,
  Droplets,
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
  ZoomIn,
} from 'lucide-react';
import { GlassSurface } from '@/components/liquid-glass/glass-surface';
import { GlassCard } from '@/components/liquid-glass/glass-card';
import {
  GlassDialog,
  GlassDialogTrigger,
  GlassDialogContent,
  GlassDialogHeader,
  GlassDialogTitle,
  GlassDialogDescription,
  GlassDialogFooter,
  GlassDialogClose,
} from '@/components/liquid-glass/glass-dialog';
import {
  GlassTabs,
  GlassTabsList,
  GlassTabsTab,
  GlassTabsPanel,
} from '@/components/liquid-glass/glass-tabs';
import { GlassSwitch } from '@/components/liquid-glass/glass-switch';
import { GlassSlider } from '@/components/liquid-glass/glass-slider';
import {
  GlassDropdownMenu,
  GlassDropdownMenuTrigger,
  GlassDropdownMenuContent,
  GlassDropdownMenuItem,
  GlassDropdownMenuSeparator,
} from '@/components/liquid-glass/glass-dropdown-menu';
import {
  GlassDropletMenu,
  GlassDropletMenuTrigger,
  GlassDropletMenuContent,
  GlassDropletMenuItem,
  GlassDropletMenuSeparator,
} from '@/components/liquid-glass/glass-droplet-menu';
import {
  GlassText,
  GlassShape,
  GlassLens,
  GlassLoupe,
  GlassButton,
  GlassRipple,
} from '@liquidglassjs/react';
import { mountGlassGroup, type GlassGroup } from '@liquidglassjs/core';
import { GlassQR } from '@liquidglassjs/qr/react';

/** Where the registry JSON is hosted (served from the showcase's own deploy). */
export const REGISTRY_URL = 'https://amir-abushanab.github.io/liquid-glass-js';
// Slider ranges and shipped defaults for every glass component on this site — the
// same source the vanilla showcase reads, so a retune lands in both.
import { presetControls } from './glass-presets';
import { SCENE } from './scene';

// The lens preview sizes its own lens, so `radius` isn't a knob here.
const LENS_KEYS = ['strength', 'chroma', 'blur', 'dome', 'depth', 'edge', 'glow', 'shade'];

// The rim-falloff curve of the displacement map — a structural control shared by
// every rounded-rect glass (lens/loupe/surface/card/button). 'circle' is the
// iOS-style ring: full displacement exactly at the rim; 'erf' the soft meniscus.
const profileControl = {
  kind: 'select',
  key: 'profile',
  label: 'Rim profile',
  options: [
    { label: 'Meniscus (erf)', value: 'erf' },
    { label: 'Ring (circle)', value: 'circle' },
  ],
  default: 'erf',
} satisfies TuneControl;
const profileOf = (o?: TuneOptions): 'erf' | 'circle' =>
  o?.profile === 'circle' ? 'circle' : 'erf';
// Snippet fragment: the prop appears only when it differs from the default.
const profileAttr = (o?: TuneOptions): string =>
  o?.profile === 'circle' ? '\n      profile="circle"' : '';
// Same, for the single-line prop templates (tabs/dialog/dropdown/slider/switch).
const profileAttrInline = (o?: TuneOptions): string =>
  o?.profile === 'circle' ? ' profile="circle"' : '';

export type Category = 'Components' | 'Effects';

/** One tunable glass parameter — drives a slider in the preview's Tuner. */
export type TuneParam = {
  key: string;
  label?: string;
  min: number;
  max: number;
  step: number;
  default: number;
};

/**
 * A non-numeric, structural control (toggle / choice / free text). Unlike the
 * numeric `params` — which reconfigure the live glass shader in place — changing
 * one of these re-mounts the demo (they map to props in the component's struct
 * key: the QR's `value`, `logo`, `reserveCenter`). Kept in a separate value
 * space (`TuneOptions`) so the slider channel stays purely numeric.
 */
export type TuneControl =
  | {
      kind: 'toggle';
      key: string;
      label?: string;
      default: boolean;
      disabled?: (o: TuneOptions) => boolean;
    }
  | {
      kind: 'select';
      key: string;
      label?: string;
      options: { label: string; value: string }[];
      default: string;
      disabled?: (o: TuneOptions) => boolean;
      /**
       * Colour preview for the current value, shown as swatches inline beside the
       * dropdown. Native `<option>`s can't carry a swatch, so this reflects the
       * selection rather than every row. Return `[]` for a value with no colour.
       */
      swatches?: (value: string) => string[];
    }
  | {
      kind: 'text';
      key: string;
      label?: string;
      default: string;
      placeholder?: string;
      maxLength?: number;
      disabled?: (o: TuneOptions) => boolean;
    }
  | {
      kind: 'palette';
      key: string;
      label?: string;
      /** Comma-joined hex, e.g. `'#1db954,#ff3200'`; each colour edits via a native picker. */
      default: string;
      /** Colour-count bounds for the add/remove affordances (defaults 1…5). */
      min?: number;
      max?: number;
      disabled?: (o: TuneOptions) => boolean;
    };

/** Parse a comma-joined palette string into hex colours (drops blanks). */
export const parsePalette = (s: string): string[] =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

/** Join a palette back to the comma string stored in a `palette` control's value. */
export const joinPalette = (a: string[]): string => a.join(',');

/** A `#rrggbb` colour — the only shape the QR's hex parsers (and native pickers) accept. */
const isHexColor = (s: string): boolean => /^#[0-9a-fA-F]{6}$/.test(s);

/** Current value of each structural control, e.g. `{ value: '…', logo: 'default', reserveCenter: true }`. */
export type TuneOptions = Record<string, string | boolean>;

/** A component's live-tuning config: which params to expose + how to regenerate the snippet. */
export interface TuneConfig {
  params: TuneParam[];
  /** Structural (re-mounting) controls — text/toggle/choice — shown above the sliders. */
  controls?: TuneControl[];
  /** Build the copy-pastable snippet from the current numeric values and structural options. */
  code: (v: Record<string, number>, o?: TuneOptions) => string;
  /**
   * Browser capability the glass needs before these params have any visible
   * effect. Frost shells refract via `backdrop-filter: url()` (Chromium only —
   * elsewhere they fall back to a plain blur that ignores every refraction
   * param); the QR runs a WebGL2 shader. Where the capability is missing the
   * Tuner disables its sliders with a note instead of silently doing nothing.
   * Omit for the SVG-filter paths (text/shape/lens/button/ripple, slider/switch),
   * which honor every param in every browser.
   */
  needs?: 'backdrop-url' | 'webgl2';
}

/** Default value for each tunable param, e.g. `{ strength: 11, … }`. */
export const tuneDefaults = (t: TuneConfig): Record<string, number> =>
  Object.fromEntries(t.params.map((p) => [p.key, p.default]));

/** Default value for each structural control, e.g. `{ value: '…', logo: 'default' }`. */
export const controlDefaults = (t: TuneConfig): TuneOptions =>
  Object.fromEntries((t.controls ?? []).map((c) => [c.key, c.default]));

export type RenderPath = 'svg' | 'webgl' | 'frost';

/**
 * Which render path a preview's glass runs on — the same taxonomy as the
 * showcase's render-path chips. Derived from `needs` so the two can't drift:
 * backdrop-url *is* the frost path's refract mechanism, webgl2 is the shader
 * path, and everything else here rides the works-everywhere SVG filter.
 */
export const renderPathOf = (t: TuneConfig): RenderPath =>
  t.needs === 'backdrop-url' ? 'frost' : t.needs === 'webgl2' ? 'webgl' : 'svg';

export interface RegistryItem {
  slug: string;
  title: string;
  category: Category;
  /** Sidebar / card glyph. */
  icon: LucideIcon;
  /** One-line summary shown under the title. */
  description: string;
  /** npm package for effect bindings; omit for shadcn-registry shells. */
  npm?: string;
  /** The usage snippet shown in the Code tab (untuned default; tuned items regenerate it via `tune.code`). */
  code: string;
  /**
   * The live preview. Receives the current numeric `values` and structural
   * `options` (both undefined/empty for untuned items).
   */
  Demo: FC<{ values?: Record<string, number>; options?: TuneOptions }>;
  /** When set, the preview shows a live parameter tuner and shareable URL state. */
  tune?: TuneConfig;
}

const triggerClass =
  'rounded-full bg-white/15 px-5 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/25';

/** The dark, grid-lined pane the ripple bends — same look as the showcase button. */
const ripplePane =
  'radial-gradient(90% 130% at 50% 0%, rgba(123,60,255,0.55), transparent 62%),' +
  'repeating-linear-gradient(0deg, rgb(255 255 255 / 5%) 0 1px, transparent 1px 20px),' +
  'repeating-linear-gradient(90deg, rgb(255 255 255 / 5%) 0 1px, transparent 1px 20px),' +
  'linear-gradient(180deg, #17131f, #0a0813)';

/** The aurora gradient the brand droplet is filled with. */
const dropletFill = 'M32 4 C 46 22 52 30 52 40 A 20 20 0 1 1 12 40 C 12 30 18 22 32 4 Z';

/** Chips that morph the Glass Button label — mirrors the showcase "content morph". */
const morphLabels = ['Download', 'Play', 'Pause', 'Search', '🎉 Ship it', 'v2.4.1'];

const swatches = [
  '#8a7bff',
  '#39d1f9',
  '#ffb400',
  '#ff5ca8',
  '#5ce0a8',
  '#8a7bff',
  '#39d1f9',
  '#ffb400',
  '#ff5ca8',
];

// ── Live-tuning configs: the params each preview's Tuner exposes, and how the
//    tuned values regenerate the copy-pastable snippet. ─────────────────────────
const SHAPE_TUNE: TuneConfig = {
  // Every GlassShape param, in interface order (see AlphaGlassParams): the
  // displacement knobs, then the map knobs (bevel/dome/edge/glow/shade).
  params: presetControls('shape'),
  code: (v) => `import { GlassShape } from "@liquidglassjs/react"

export function Example() {
  return (
    <GlassShape strength={${v.strength}} chroma={${v.chroma}} blur={${v.blur}} bevel={${v.bevel}} dome={${v.dome}} edge={${v.edge}} glow={${v.glow}} shade={${v.shade}}>
      <svg width="140" height="140" viewBox="0 0 64 64">
        <path fill="#8b6bff" d="M32 4 C 46 22 52 30 52 40 A 20 20 0 1 1 12 40 C 12 30 18 22 32 4 Z" />
      </svg>
    </GlassShape>
  )
}`,
};

const LENS_TUNE: TuneConfig = {
  // `press` is the react binding's held-pointer boost, not a core lens param, so it
  // lives here rather than in glass-presets (the vanilla showcase has no gesture).
  params: [
    ...presetControls('lens', LENS_KEYS),
    { key: 'press', label: 'press', min: 1, max: 1.6, step: 0.05, default: 1.25 },
  ],
  controls: [profileControl],
  code: (v, o) => `import { GlassLens } from "@liquidglassjs/react"

export function Example() {
  return (
    <GlassLens
      width={150}
      height={150}
      radius={60}
      strength={${v.strength}}
      chroma={${v.chroma}}
      blur={${v.blur}}
      dome={${v.dome}}
      depth={${v.depth}}${profileAttr(o)}
      edge={${v.edge}}
      glow={${v.glow}}
      shade={${v.shade}}
      press={${v.press}}
      glint="#ffd9a0"
      className="h-[280px] w-full max-w-[560px] overflow-hidden rounded-xl"
    >
      <div className="relative h-full w-full bg-zinc-950 text-white">
        {/* live content — refracted under the lens */}
      </div>
    </GlassLens>
  )
}`,
};

// Every GlassLoupeParam, in interface order: the magnifier's own geometry (how much
// to enlarge, the capsule's box, where it sits relative to the pointer, how long the
// hold is) and then the lens refraction it shares with GlassLens. `hold` is here
// rather than in `controls` because it reconfigures live like the rest — it's read
// at pointerdown, so a change lands on the next gesture without a remount.
const LOUPE_TUNE: TuneConfig = {
  params: presetControls('loupe'),
  controls: [profileControl],
  code: (v, o) => `import { GlassLoupe } from "@liquidglassjs/react"

export function Example() {
  return (
    <GlassLoupe
      zoom={${v.zoom}}
      longPressMs={${v.longPressMs}}
      width={${v.width}}
      height={${v.height}}
      radius={${v.radius}}
      offsetY={${v.offsetY}}
      strength={${v.strength}}
      chroma={${v.chroma}}
      blur={${v.blur}}
      dome={${v.dome}}
      depth={${v.depth}}${profileAttr(o)}
      edge={${v.edge}}
      glow={${v.glow}}
      shade={${v.shade}}
      glint="#ffd9a0"
      className="columns-2 gap-6 rounded-xl border p-6 text-[9.5px] leading-relaxed"
    >
      {/* any live DOM — press and hold to magnify it */}
      <p>…</p>
    </GlassLoupe>
  )
}`,
};

const TEXT_TUNE: TuneConfig = {
  params: presetControls('text'),
  code: (v) => `import { GlassText } from "@liquidglassjs/react"

export function Example() {
  return (
    <GlassText
      strength={${v.strength}}
      chroma={${v.chroma}}
      blur={${v.blur}}
      bevel={${v.bevel}}
      dome={${v.dome}}
      edge={${v.edge}}
      glow={${v.glow}}
      shade={${v.shade}}
      className="text-6xl font-black text-white"
    >
      Refraction
    </GlassText>
  )
}`,
};

// No `needs` here any more. Given a `backdrop`, mountGlass takes the SVG clone path,
// which refracts in every browser — the frost fallback is only where a surface is given
// nothing to refract.
const SURFACE_TUNE: TuneConfig = {
  params: presetControls('surface'),
  controls: [profileControl],
  code: (v, o) => `import { GlassSurface } from "@/components/liquid-glass/glass-surface"

export function Example() {
  return (
    <GlassSurface
      strength={${v.strength}}
      chroma={${v.chroma}}
      blur={${v.blur}}
      dome={${v.dome}}
      depth={${v.depth}}${profileAttr(o)}
      edge={${v.edge}}
      glow={${v.glow}}
      spec={${v.spec}}
      tint={${v.tint}}
      vibrancy={${v.vibrancy}}
      // Hand it the page's own background and it refracts that, in every browser.
      // Leave it out and there is nothing to refract, so it falls back to a frost.
      backdrop="radial-gradient(70% 80% at 30% 20%, #12d3ff, transparent 60%), #0b0913"
      className="max-w-xs p-6"
    >
      <h2 className="text-lg font-semibold text-white">Glass surface</h2>
      <p className="mt-1 text-sm text-white/75">Content over refracting glass.</p>
    </GlassSurface>
  )
}`,
};

const CARD_TUNE: TuneConfig = {
  params: SURFACE_TUNE.params,
  controls: [profileControl],
  code: (v, o) => `import { GlassCard } from "@/components/liquid-glass/glass-card"

export function Example() {
  return (
    <GlassCard
      strength={${v.strength}}
      chroma={${v.chroma}}
      blur={${v.blur}}
      dome={${v.dome}}
      depth={${v.depth}}${profileAttr(o)}
      edge={${v.edge}}
      glow={${v.glow}}
      spec={${v.spec}}
      tint={${v.tint}}
      vibrancy={${v.vibrancy}}
      // Hand it the page's own background and it refracts that, in every browser.
      // Leave it out and there is nothing to refract, so it falls back to a frost.
      backdrop="radial-gradient(70% 80% at 30% 20%, #12d3ff, transparent 60%), #0b0913"
      className="max-w-xs"
    >
      <h2 className="text-lg font-semibold text-white">Glass card</h2>
      <p className="mt-1 text-sm text-white/75">glass-surface + a border + a shadow.</p>
    </GlassCard>
  )
}`,
};

const BUTTON_TUNE: TuneConfig = {
  // Surface knobs, then geometry + morph-animation (radius/duration/pulse re-mount).
  params: presetControls('button'),
  controls: [profileControl],
  code: (v, o) => `import { GlassButton } from "@liquidglassjs/react"

export function Example() {
  return (
    <GlassButton
      strength={${v.strength}}
      chroma={${v.chroma}}
      blur={${v.blur}}
      dome={${v.dome}}
      depth={${v.depth}}${profileAttr(o)}
      edge={${v.edge}}
      glow={${v.glow}}
      spec={${v.spec}}
      radius={${v.radius}}
      duration={${v.duration}}
      pulse={${v.pulse}}
      className="h-12 rounded-2xl px-6 font-semibold text-white"
    >
      Download
    </GlassButton>
  )
}`,
};

const RIPPLE_TUNE: TuneConfig = {
  params: presetControls('ripple'),
  code: (v) => `import { GlassRipple } from "@liquidglassjs/react"

export function Example() {
  return (
    <GlassRipple
      strength={${v.strength}}
      chroma={${v.chroma}}
      spec={${v.spec}}
      blur={${v.blur}}
      maxFrac={${v.maxFrac}}
      duration={${v.duration}}
      className="h-[60px] w-56 rounded-[18px] font-semibold text-white"
    >
      npm i liquid-glass →
    </GlassRipple>
  )
}`,
};

const MERGE_TUNE: TuneConfig = {
  params: presetControls('merge'),
  controls: [profileControl],
  code: (v, o) => `import { mountGlassGroup } from "@liquidglassjs/core"

const group = mountGlassGroup({
  target: scene,          // the live DOM that bends
  host: wrap,
  items: [pillA, pillB],  // chrome above the scene — measured, never filtered
  blend: ${v.blend},${o?.profile === 'circle' ? '\n  profile: "circle",' : ''}
  strength: ${v.strength},
  chroma: ${v.chroma},
  depth: ${v.depth},
  edge: ${v.edge},
  glow: ${v.glow},
  shade: ${v.shade},
  specularRotation: ${v.specularRotation}, // light angle — quantize if you drive it live
  blur: ${v.blur},
})

// after moving an item (transform, layout, drag):
group.update() // rAF-coalesced re-measure + map re-encode`,
};

/**
 * Two pills over one scene, one following the pointer: both live in a single
 * smooth-min displacement map, so bringing them within `blend` px fuses their
 * rims through a neck — Apple's droplet merge. The pills are chrome ABOVE the
 * refracted pane (never filtered), so sliding one with a transform is safe in
 * Safari; the map is measured from where they visually are.
 */
function GlassMergeDemo({ v, o }: { v: Record<string, number>; o: TuneOptions }) {
  const wrap = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const pillA = useRef<HTMLDivElement>(null);
  const pillB = useRef<HTMLDivElement>(null);
  const group = useRef<GlassGroup | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el || !scene.current || !pillA.current || !pillB.current) return;
    const g = mountGlassGroup({
      target: scene.current,
      host: el,
      items: [pillA.current, pillB.current],
    });
    group.current = g;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const pb = pillB.current;
      if (!pb) return;
      const w = pb.offsetWidth;
      const x = Math.min(Math.max(e.clientX - r.left - w / 2, 8), r.width - w - 8);
      pb.style.transform = `translate(${x}px, -50%)`;
      g.update();
    };
    el.addEventListener('pointermove', move);
    return () => {
      el.removeEventListener('pointermove', move);
      g.dispose();
      group.current = null;
    };
  }, []);
  const key = JSON.stringify([v, o]);
  useEffect(() => {
    group.current?.reconfigure({
      blend: v.blend,
      strength: v.strength,
      chroma: v.chroma,
      depth: v.depth,
      edge: v.edge,
      glow: v.glow,
      shade: v.shade,
      specularRotation: v.specularRotation,
      blur: v.blur,
      profile: profileOf(o),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key captures both
  }, [key]);
  return (
    <div
      ref={wrap}
      className="relative w-full max-w-[560px] cursor-ew-resize touch-none overflow-hidden rounded-xl ring-1 ring-white/10"
    >
      <div ref={scene} className="relative h-[220px] w-full overflow-hidden bg-zinc-950 text-white">
        <div className="absolute inset-0 [background:radial-gradient(90%_130%_at_50%_0%,rgba(123,60,255,0.4),transparent_62%),repeating-linear-gradient(0deg,rgb(255_255_255/6%)_0_1px,transparent_1px_22px),repeating-linear-gradient(90deg,rgb(255_255_255/6%)_0_1px,transparent_1px_22px)]" />
        <span className="absolute top-5 left-6 rounded border border-white/25 px-1.5 py-0.5 text-[10px] font-medium tracking-[0.2em] text-white/80 uppercase">
          MOUNTGLASSGROUP
        </span>
        <h3 className="absolute top-12 left-6 text-lg font-semibold">Both pills share one map</h3>
        <p className="absolute top-[76px] left-6 text-[11px] text-white/50">
          steer the loose one into the anchored one
        </p>
        <div className="absolute bottom-5 left-6 flex gap-1.5">
          {swatches.slice(0, 6).map((c, i) => (
            <i
              key={i}
              className="block h-[15px] w-[24px] rounded-[3px]"
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      <div
        ref={pillA}
        className="pointer-events-none absolute top-1/2 left-8 flex h-14 w-36 -translate-y-1/2 items-center justify-center rounded-full text-sm font-medium text-white/90"
      >
        anchored
      </div>
      <div
        ref={pillB}
        className="pointer-events-none absolute top-1/2 left-0 flex h-14 w-28 items-center justify-center rounded-full text-sm font-medium text-white/90"
        style={{ transform: 'translate(320px, -50%)' }}
      >
        loose
      </div>
    </div>
  );
}

// The centre mark for the QR's "Emoji" logo choice — a markup string (GlassQR
// accepts `string | Node | false`); the span self-centres and sizes the glyph.
const QR_EMOJI_LOGO =
  '<span style="display:grid;place-items:center;width:100%;height:100%;font-size:1.9rem">⚡</span>';

/** Map the `logo` choice to the GlassQR `logo` prop (default mark / custom / none). */
const qrLogoProp = (choice: unknown): string | false | undefined =>
  choice === 'none' ? false : choice === 'emoji' ? QR_EMOJI_LOGO : undefined;

/** The QR reserves its centre whenever a mark is shown; only "no logo" honours the toggle. */
const qrReserveCenter = (o: TuneOptions): boolean =>
  o.logo === 'none' ? Boolean(o.reserveCenter) : true;

/** Render the `logo` prop as it should appear in the copy-pastable snippet. */
const qrLogoSource = (choice: unknown): string | null =>
  choice === 'none'
    ? '{false}'
    : choice === 'emoji'
      ? `"${QR_EMOJI_LOGO.replace(/"/g, '\\"')}"`
      : null;

// Preset palettes for the "splash palette" control — a single-colour brand accent
// and two multi-colour sets, to show `splashColors` is an array of any length. The
// default ('default') maps to `undefined`, keeping the library's built-in palette.
const QR_SPLASH_PALETTES: Record<string, string[]> = {
  emerald: ['#1DB954'],
  sunset: ['#FF3200', '#FFB400', '#FF5CA8'],
  ocean: ['#39D1F9', '#5CE0A8', '#8A7BFF'],
};

/**
 * Map the palette choice to the GlassQR `splashColors` prop. A preset reads the
 * palette table; 'custom' parses the `customSplash` builder (valid hex only);
 * 'default' (or nothing valid) → undefined, keeping the library's built-in palette.
 */
const qrSplashColors = (o: TuneOptions): string[] | undefined => {
  if (o.splashColors === 'custom') {
    const c = parsePalette(String(o.customSplash ?? '')).filter(isHexColor);
    return c.length ? c : undefined;
  }
  return typeof o.splashColors === 'string' ? QR_SPLASH_PALETTES[o.splashColors] : undefined;
};

/** Map the eye-colour choice to the GlassQR `eyeColor` prop ('dots' → follow dotColor). */
const qrEyeColor = (choice: unknown): string | undefined =>
  typeof choice === 'string' && choice !== 'dots' ? choice : undefined;

/** Render `splashColors` as the array literal in the snippet, e.g. `['#1DB954']`. */
const qrSplashSource = (o: TuneOptions): string | null => {
  const p = qrSplashColors(o);
  return p ? `[${p.map((c) => `'${c}'`).join(', ')}]` : null;
};

// Inline-swatch colours per splash-palette choice; 'default' previews core's
// built-in SPLASH_COLORS (mirrored here so the showcase doesn't import the barrel).
const QR_SPLASH_SWATCHES: Record<string, string[]> = {
  default: ['#9896FF', '#39D1F9', '#FFB400', '#FF3200'],
  ...QR_SPLASH_PALETTES,
};

const QR_TUNE: TuneConfig = {
  needs: 'webgl2',
  controls: [
    {
      kind: 'text',
      key: 'value',
      label: 'value',
      default: 'https://liquidglassjs.dev',
      placeholder: 'URL or text',
      maxLength: 300,
    },
    {
      kind: 'select',
      key: 'logo',
      label: 'logo',
      options: [
        { label: 'Default mark', value: 'default' },
        { label: 'Emoji ⚡', value: 'emoji' },
        { label: 'None', value: 'none' },
      ],
      default: 'default',
    },
    // Only meaningful without a logo — a mark always reserves its own hole, so the
    // toggle disables (and reads as on) whenever a logo is shown.
    {
      kind: 'toggle',
      key: 'reserveCenter',
      label: 'reserve center',
      default: true,
      disabled: (o) => o.logo !== 'none',
    },
    // Colour options re-mount the QR (same channel as value/logo). 'dots'/'default'
    // emit no prop, so the eyes follow dotColor and the ripple keeps the built-in palette.
    {
      kind: 'select',
      key: 'eyeColor',
      label: 'eye color',
      options: [
        { label: 'Match dots', value: 'dots' },
        { label: 'Emerald', value: '#1DB954' },
        { label: 'Amber', value: '#FFB400' },
        { label: 'Rose', value: '#FF5CA8' },
      ],
      default: 'dots',
      // 'dots' previews the demo's dotColor; every other value is itself a colour.
      swatches: (v) => (v === 'dots' ? ['#f6f6f6'] : [v]),
    },
    {
      kind: 'select',
      key: 'splashColors',
      label: 'splash palette',
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Emerald (1)', value: 'emerald' },
        { label: 'Sunset (3)', value: 'sunset' },
        { label: 'Ocean (3)', value: 'ocean' },
        { label: 'Custom…', value: 'custom' },
      ],
      default: 'default',
      // 'custom' shows its colours in the builder below, so no beside-swatch for it.
      swatches: (v) => QR_SPLASH_SWATCHES[v] ?? [],
    },
    // Enabled only when "Custom…" is chosen. Native pickers emit valid #rrggbb, so
    // the shader can't be handed a broken hex; unused when a preset is selected.
    {
      kind: 'palette',
      key: 'customSplash',
      label: 'custom colors',
      default: '#1db954,#ff3200',
      min: 1,
      max: 5,
      disabled: (o) => o.splashColors !== 'custom',
    },
    // Re-mounts the QR; when on, the press animation fires once as it's revealed
    // (respects prefers-reduced-motion). Toggle it to replay the entrance.
    {
      kind: 'toggle',
      key: 'playOnReveal',
      label: 'play on reveal',
      default: false,
    },
  ],
  // Shape first (dots → squares, and how sharp the card is), then the refraction
  // knobs, then the click-bloom animation timings.
  params: presetControls('qr'),
  code: (v, o = {}) => {
    const logoSrc = qrLogoSource(o.logo);
    const reserve = qrReserveCenter(o);
    const eye = qrEyeColor(o.eyeColor);
    const splashSrc = qrSplashSource(o);
    return `import { GlassQR } from "@liquidglassjs/qr/react"

export function Example() {
  return (
    <GlassQR
      value="${String(o.value || 'https://liquidglassjs.dev')}"
      size={220}
      dotColor="#f6f6f6"
      backgroundColor="#0a0a0a"${eye ? `\n      eyeColor="${eye}"` : ''}${splashSrc ? `\n      splashColors={${splashSrc}}` : ''}${logoSrc ? `\n      logo=${logoSrc}` : ''}${logoSrc === '{false}' && reserve ? '\n      reserveCenter' : ''}
      moduleRadius={${v.moduleRadius}}
      moduleScale={${v.moduleScale}}
      eyeRadius={${v.eyeRadius}}
      frameRadius={${v.frameRadius}}
      scaleX={${v.scaleX}}
      scaleY={${v.scaleY}}
      chromaAmount={${v.chromaAmount}}
      eyeRefractionScale={${v.eyeRefractionScale}}
      lensDepth={${v.lensDepth}}
      lensDuration={${v.lensDuration}}
      colorSplash={${v.colorSplash}}
      ringStart={${v.ringStart}}
      ringEnd={${v.ringEnd}}${o.playOnReveal ? '\n      playOnReveal' : ''}
      className="rounded-2xl"
    />
  )
}`;
  },
};

// Frost shells (tabs/dialog/dropdown) share one param set; the glass is subtle and
// only shows when the panel/pill is visible, so tune, then open/hover to preview.
const FROST_PARAMS: TuneParam[] = [
  { key: 'strength', min: 0, max: 40, step: 0.5, default: 12 },
  { key: 'chroma', min: 0, max: 1.5, step: 0.02, default: 0.4 },
  { key: 'dome', min: 0, max: 30, step: 0.5, default: 10 },
  { key: 'depth', min: 0, max: 30, step: 0.5, default: 8 },
  { key: 'edge', min: 0, max: 2, step: 0.05, default: 0.9 },
  { key: 'glow', min: 0, max: 2, step: 0.05, default: 0.3 },
];

const TABS_TUNE: TuneConfig = {
  needs: 'backdrop-url',
  params: FROST_PARAMS,
  controls: [profileControl],
  code: (v, o) => `import {
  GlassTabs, GlassTabsList, GlassTabsTab, GlassTabsPanel,
} from "@/components/liquid-glass/glass-tabs"

export function Example() {
  return (
    <GlassTabs defaultValue="overview">
      <GlassTabsList strength={${v.strength}} chroma={${v.chroma}} dome={${v.dome}} depth={${v.depth}} edge={${v.edge}} glow={${v.glow}}${profileAttrInline(o)}>
        <GlassTabsTab value="overview">Overview</GlassTabsTab>
        <GlassTabsTab value="activity">Activity</GlassTabsTab>
        <GlassTabsTab value="settings">Settings</GlassTabsTab>
      </GlassTabsList>
    </GlassTabs>
  )
}`,
};

const DIALOG_TUNE: TuneConfig = {
  needs: 'backdrop-url',
  params: FROST_PARAMS,
  controls: [profileControl],
  code: (v, o) => `import {
  GlassDialog, GlassDialogTrigger, GlassDialogContent,
  GlassDialogHeader, GlassDialogTitle, GlassDialogDescription,
} from "@/components/liquid-glass/glass-dialog"

export function Example() {
  return (
    <GlassDialog>
      <GlassDialogTrigger>Open dialog</GlassDialogTrigger>
      <GlassDialogContent strength={${v.strength}} chroma={${v.chroma}} dome={${v.dome}} depth={${v.depth}} edge={${v.edge}} glow={${v.glow}}${profileAttrInline(o)}>
        <GlassDialogHeader>
          <GlassDialogTitle>Delete project</GlassDialogTitle>
          <GlassDialogDescription>This can&apos;t be undone.</GlassDialogDescription>
        </GlassDialogHeader>
      </GlassDialogContent>
    </GlassDialog>
  )
}`,
};

const DROPDOWN_TUNE: TuneConfig = {
  needs: 'backdrop-url',
  params: FROST_PARAMS,
  controls: [profileControl],
  code: (v, o) => `import {
  GlassDropdownMenu, GlassDropdownMenuTrigger, GlassDropdownMenuContent,
  GlassDropdownMenuItem, GlassDropdownMenuSeparator,
} from "@/components/liquid-glass/glass-dropdown-menu"

export function Example() {
  return (
    <GlassDropdownMenu>
      <GlassDropdownMenuTrigger>Options</GlassDropdownMenuTrigger>
      <GlassDropdownMenuContent strength={${v.strength}} chroma={${v.chroma}} dome={${v.dome}} depth={${v.depth}} edge={${v.edge}} glow={${v.glow}}${profileAttrInline(o)}>
        <GlassDropdownMenuItem>Profile</GlassDropdownMenuItem>
        <GlassDropdownMenuItem>Settings</GlassDropdownMenuItem>
        <GlassDropdownMenuSeparator />
        <GlassDropdownMenuItem>Sign out</GlassDropdownMenuItem>
      </GlassDropdownMenuContent>
    </GlassDropdownMenu>
  )
}`,
};

// The droplet menu runs the merge path (SVG filter on a masked pane — every
// browser), not the frost path, so no `needs` and the full merge param set.
const DROPLET_TUNE: TuneConfig = {
  params: presetControls('merge'),
  controls: [
    profileControl,
    { kind: 'toggle', key: 'attached', label: 'Stay attached at rest', default: false },
  ],
  code: (v, o) => `import {
  GlassDropletMenu, GlassDropletMenuTrigger, GlassDropletMenuContent,
  GlassDropletMenuItem, GlassDropletMenuSeparator,
} from "@/components/liquid-glass/glass-droplet-menu"

export function Example() {
  // One glass surface spans trigger and panel: opening grows the menu out of
  // the pill through a liquid neck that pinches off as the panel settles.
  // Hand \`backdrop\` your page's background.
  return (
    <GlassDropletMenu
      backdrop={pageBackground}
      blend={${v.blend}}${o?.attached ? '\n      attached' : ''}${o?.profile === 'circle' ? '\n      profile="circle"' : ''}
      strength={${v.strength}}
      chroma={${v.chroma}}
      depth={${v.depth}}
      edge={${v.edge}}
      glow={${v.glow}}
      shade={${v.shade}}
      specularRotation={${v.specularRotation}}
      blur={${v.blur}}
    >
      <GlassDropletMenuTrigger>Actions</GlassDropletMenuTrigger>
      <GlassDropletMenuContent>
        <GlassDropletMenuItem>Profile</GlassDropletMenuItem>
        <GlassDropletMenuItem>Settings</GlassDropletMenuItem>
        <GlassDropletMenuSeparator />
        <GlassDropletMenuItem>Sign out</GlassDropletMenuItem>
      </GlassDropletMenuContent>
    </GlassDropletMenu>
  )
}`,
};

const SLIDER_TUNE: TuneConfig = {
  params: presetControls('slider'),
  controls: [profileControl],
  code: (v, o) => `import { GlassSlider } from "@/components/liquid-glass/glass-slider"

export function Example() {
  // Drag the thumb to see the rail refract through the glass.
  return (
    <GlassSlider defaultValue={40} strength={${v.strength}} chroma={${v.chroma}} dome={${v.dome}} depth={${v.depth}} edge={${v.edge}} glow={${v.glow}}${profileAttrInline(o)} className="w-80" />
  )
}`,
};

const SWITCH_TUNE: TuneConfig = {
  params: presetControls('switch'),
  controls: [profileControl],
  code: (v, o) => `import { GlassSwitch } from "@/components/liquid-glass/glass-switch"

export function Example() {
  // Press-and-hold to see the track refract through the glass thumb.
  return (
    <GlassSwitch defaultChecked strength={${v.strength}} chroma={${v.chroma}} dome={${v.dome}} depth={${v.depth}} edge={${v.edge}} glow={${v.glow}}${profileAttrInline(o)} />
  )
}`,
};

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
    Demo: ({
      values: v = tuneDefaults(SURFACE_TUNE),
      options: o = controlDefaults(SURFACE_TUNE),
    }) => (
      <GlassSurface
        strength={v.strength}
        chroma={v.chroma}
        blur={v.blur}
        dome={v.dome}
        depth={v.depth}
        profile={profileOf(o)}
        edge={v.edge}
        glow={v.glow}
        spec={v.spec}
        tint={v.tint}
        vibrancy={v.vibrancy}
        backdrop={SCENE}
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
    Demo: ({ values: v = tuneDefaults(CARD_TUNE), options: o = controlDefaults(CARD_TUNE) }) => (
      <GlassCard
        strength={v.strength}
        chroma={v.chroma}
        blur={v.blur}
        dome={v.dome}
        depth={v.depth}
        profile={profileOf(o)}
        edge={v.edge}
        glow={v.glow}
        spec={v.spec}
        tint={v.tint}
        vibrancy={v.vibrancy}
        backdrop={SCENE}
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
    Demo: ({
      values: v = tuneDefaults(DIALOG_TUNE),
      options: o = controlDefaults(DIALOG_TUNE),
    }) => (
      <GlassDialog>
        <GlassDialogTrigger className={triggerClass}>Open dialog</GlassDialogTrigger>
        <GlassDialogContent
          strength={v.strength}
          chroma={v.chroma}
          dome={v.dome}
          depth={v.depth}
          edge={v.edge}
          glow={v.glow}
          profile={profileOf(o)}
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
    Demo: ({ values: v = tuneDefaults(TABS_TUNE), options: o = controlDefaults(TABS_TUNE) }) => (
      <GlassTabs defaultValue="daily">
        <GlassTabsList
          strength={v.strength}
          chroma={v.chroma}
          dome={v.dome}
          depth={v.depth}
          edge={v.edge}
          glow={v.glow}
          profile={profileOf(o)}
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
    Demo: ({
      values: v = tuneDefaults(SWITCH_TUNE),
      options: o = controlDefaults(SWITCH_TUNE),
    }) => (
      <div className="flex items-center gap-4">
        <GlassSwitch
          defaultChecked
          strength={v.strength}
          chroma={v.chroma}
          dome={v.dome}
          depth={v.depth}
          edge={v.edge}
          glow={v.glow}
          profile={profileOf(o)}
        />
        <GlassSwitch
          profile={profileOf(o)}
          strength={v.strength}
          chroma={v.chroma}
          dome={v.dome}
          depth={v.depth}
          edge={v.edge}
          glow={v.glow}
        />
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
    Demo: ({
      values: v = tuneDefaults(SLIDER_TUNE),
      options: o = controlDefaults(SLIDER_TUNE),
    }) => (
      <GlassSlider
        defaultValue={40}
        strength={v.strength}
        chroma={v.chroma}
        dome={v.dome}
        depth={v.depth}
        edge={v.edge}
        glow={v.glow}
        profile={profileOf(o)}
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
      'A dropdown menu: Base UI Menu (anchored positioning, roving focus, typeahead) with a refracting glass popup.',
    tune: DROPDOWN_TUNE,
    code: DROPDOWN_TUNE.code(tuneDefaults(DROPDOWN_TUNE)),
    Demo: ({
      values: v = tuneDefaults(DROPDOWN_TUNE),
      options: o = controlDefaults(DROPDOWN_TUNE),
    }) => (
      <GlassDropdownMenu>
        <GlassDropdownMenuTrigger className={triggerClass}>Options</GlassDropdownMenuTrigger>
        <GlassDropdownMenuContent
          strength={v.strength}
          chroma={v.chroma}
          dome={v.dome}
          depth={v.depth}
          edge={v.edge}
          glow={v.glow}
          profile={profileOf(o)}
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

  {
    slug: 'glass-droplet-menu',
    title: 'Glass Droplet Menu',
    category: 'Components',
    icon: Combine,
    description:
      'The dropdown as one liquid surface: the panel grows out of the trigger pill through a smooth-min neck — the droplet merge, on Base UI Menu.',
    tune: DROPLET_TUNE,
    code: DROPLET_TUNE.code(tuneDefaults(DROPLET_TUNE)),
    Demo: ({
      values: v = tuneDefaults(DROPLET_TUNE),
      options: o = controlDefaults(DROPLET_TUNE),
    }) => (
      // Bottom spacer: the droplet opens downward, and its pane paints the scene
      // backdrop — landing it past the stage would paint scene over the page chrome.
      <div className="flex flex-col items-center pb-48">
        <GlassDropletMenu
          backdrop={SCENE}
          blend={v.blend}
          strength={v.strength}
          chroma={v.chroma}
          depth={v.depth}
          edge={v.edge}
          glow={v.glow}
          shade={v.shade}
          specularRotation={v.specularRotation}
          blur={v.blur}
          profile={profileOf(o)}
          attached={Boolean(o.attached)}
        >
          <GlassDropletMenuTrigger>Actions</GlassDropletMenuTrigger>
          <GlassDropletMenuContent>
            <GlassDropletMenuItem>Profile</GlassDropletMenuItem>
            <GlassDropletMenuItem>Settings</GlassDropletMenuItem>
            <GlassDropletMenuItem>Appearance</GlassDropletMenuItem>
            <GlassDropletMenuSeparator />
            <GlassDropletMenuItem>Sign out</GlassDropletMenuItem>
          </GlassDropletMenuContent>
        </GlassDropletMenu>
      </div>
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
        blur={v.blur}
        bevel={v.bevel}
        dome={v.dome}
        edge={v.edge}
        glow={v.glow}
        shade={v.shade}
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
        strength={v.strength}
        chroma={v.chroma}
        blur={v.blur}
        bevel={v.bevel}
        dome={v.dome}
        edge={v.edge}
        glow={v.glow}
        shade={v.shade}
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
    description:
      'A movable refraction lens over live content; the text, grid, and chips beneath it bend in place. For lenses that merge with each other, see Glass Group.',
    tune: LENS_TUNE,
    code: LENS_TUNE.code(tuneDefaults(LENS_TUNE)),
    Demo: ({ values: v = tuneDefaults(LENS_TUNE), options: o = controlDefaults(LENS_TUNE) }) => (
      <GlassLens
        width={150}
        height={150}
        radius={60}
        strength={v.strength}
        chroma={v.chroma}
        blur={v.blur}
        dome={v.dome}
        depth={v.depth}
        profile={profileOf(o)}
        edge={v.edge}
        glow={v.glow}
        shade={v.shade}
        press={v.press}
        glint="#ffd9a0"
        className="w-full max-w-[560px] overflow-hidden rounded-xl ring-1 ring-white/10"
      >
        <div className="relative h-[280px] w-full overflow-hidden bg-zinc-950 text-white">
          <div className="absolute inset-0 [background:repeating-linear-gradient(0deg,rgb(255_255_255/6%)_0_1px,transparent_1px_22px),repeating-linear-gradient(90deg,rgb(255_255_255/6%)_0_1px,transparent_1px_22px)]" />
          <span className="absolute top-6 left-7 rounded border border-white/25 px-1.5 py-0.5 text-[10px] font-medium tracking-[0.2em] text-white/80 uppercase">
            LIQUID · GLASS
          </span>
          <h3 className="absolute top-14 left-7 text-lg font-semibold">Refraction Sample 04</h3>
          <p className="absolute top-[88px] left-7 text-[11px] text-white/50">
            move the lens over live DOM
          </p>
          <div className="absolute bottom-[60px] left-7 flex gap-1.5">
            {swatches.map((c, i) => (
              <i
                key={i}
                className="block h-[17px] w-[26px] rounded-[3px]"
                style={{ background: c }}
              />
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
    slug: 'glass-loupe',
    title: 'Glass Loupe',
    category: 'Effects',
    icon: ZoomIn,
    npm: '@liquidglassjs/react',
    description:
      'The iOS text magnifier: press and hold, and a glass capsule floats above the pointer showing the line beneath it, enlarged. Drag straight away and you get an ordinary selection instead.',
    tune: LOUPE_TUNE,
    code: LOUPE_TUNE.code(tuneDefaults(LOUPE_TUNE)),
    Demo: ({ values: v = tuneDefaults(LOUPE_TUNE), options: o = controlDefaults(LOUPE_TUNE) }) => (
      <GlassLoupe
        zoom={v.zoom}
        longPressMs={v.longPressMs}
        width={v.width}
        height={v.height}
        radius={v.radius}
        offsetY={v.offsetY}
        strength={v.strength}
        chroma={v.chroma}
        blur={v.blur}
        dome={v.dome}
        depth={v.depth}
        profile={profileOf(o)}
        edge={v.edge}
        glow={v.glow}
        shade={v.shade}
        glint="#ffd9a0"
        // Two columns of genuinely small type: the case a magnifier is *for*, and
        // the one that proves the clone reflows exactly like the original.
        className="w-full max-w-[560px] columns-2 gap-6 rounded-xl bg-zinc-950 p-6 text-justify text-[9.5px] leading-relaxed text-white/70 ring-1 ring-white/10 max-sm:columns-1"
      >
        <span className="mb-3 block font-mono text-[8.5px] tracking-[0.14em] text-white/40 uppercase">
          §14 · Refraction
        </span>
        <p className="mb-3">
          Each pixel of the element beneath is displaced by the red and green channels of a
          generated bitmap, red carrying the horizontal shift and green the vertical, so that the
          rendered output bends as though seen through a dome of glass.
        </p>
        <p className="mb-3">
          The map is neutral grey everywhere outside the lens, which encodes zero displacement, and
          the content there passes through untouched and remains selectable, scrollable and
          clickable in the ordinary way.
        </p>
        <p>
          Magnification is not obtainable by displacement alone. It requires a second rendering of
          the source at a larger scale, and where that rendering is retained as document content
          rather than as a raster, the letterforms are rasterized at their final size.
        </p>
      </GlassLoupe>
    ),
  },
  {
    slug: 'glass-group',
    title: 'Glass Group',
    category: 'Effects',
    icon: Droplets,
    npm: '@liquidglassjs/core',
    description:
      'Two pills in one displacement map. Get them within half the blend distance and the rims join — no seam, because there is only one field to bend. Separate glass surfaces can never do this; the showcase\u2019s Lens stage runs on it.',
    tune: MERGE_TUNE,
    code: MERGE_TUNE.code(tuneDefaults(MERGE_TUNE)),
    Demo: ({ values: v = tuneDefaults(MERGE_TUNE), options: o = controlDefaults(MERGE_TUNE) }) => (
      <GlassMergeDemo v={v} o={o} />
    ),
  },
  {
    slug: 'glass-button',
    title: 'Glass Button',
    category: 'Effects',
    icon: MousePointerClick,
    npm: '@liquidglassjs/react',
    description:
      'Change a glass button’s label and it reshapes to fit, the refraction stretching through the morph.',
    tune: BUTTON_TUNE,
    code: BUTTON_TUNE.code(tuneDefaults(BUTTON_TUNE)),
    Demo: ({
      values: v = tuneDefaults(BUTTON_TUNE),
      options: o = controlDefaults(BUTTON_TUNE),
    }) => {
      const [label, setLabel] = useState('Download');
      return (
        <div className="flex flex-col items-center gap-5">
          <GlassButton
            strength={v.strength}
            chroma={v.chroma}
            blur={v.blur}
            dome={v.dome}
            depth={v.depth}
            profile={profileOf(o)}
            edge={v.edge}
            glow={v.glow}
            spec={v.spec}
            radius={v.radius}
            duration={v.duration}
            pulse={v.pulse}
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
      );
    },
  },
  {
    slug: 'glass-ripple',
    title: 'Glass Ripple',
    category: 'Effects',
    icon: Waves,
    npm: '@liquidglassjs/react',
    description:
      'A press sends a refraction ripple out from that point, tinted with the palette. No WebGL.',
    tune: RIPPLE_TUNE,
    code: RIPPLE_TUNE.code(tuneDefaults(RIPPLE_TUNE)),
    Demo: ({ values: v = tuneDefaults(RIPPLE_TUNE) }) => (
      <GlassRipple
        strength={v.strength}
        chroma={v.chroma}
        spec={v.spec}
        blur={v.blur}
        maxFrac={v.maxFrac}
        duration={v.duration}
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
    description:
      'A scannable QR rendered by a WebGL shader. Tap the centre for a refraction ripple.',
    tune: QR_TUNE,
    code: QR_TUNE.code(tuneDefaults(QR_TUNE), controlDefaults(QR_TUNE)),
    Demo: ({ values: v = tuneDefaults(QR_TUNE), options: o = controlDefaults(QR_TUNE) }) => (
      <GlassQR
        value={String(o.value || 'https://liquidglassjs.dev')}
        size={220}
        dotColor="#f6f6f6"
        backgroundColor="#0a0a0a"
        eyeColor={qrEyeColor(o.eyeColor)}
        splashColors={qrSplashColors(o)}
        playOnReveal={Boolean(o.playOnReveal)}
        logo={qrLogoProp(o.logo)}
        reserveCenter={qrReserveCenter(o)}
        moduleRadius={v.moduleRadius}
        moduleScale={v.moduleScale}
        eyeRadius={v.eyeRadius}
        frameRadius={v.frameRadius}
        scaleX={v.scaleX}
        scaleY={v.scaleY}
        chromaAmount={v.chromaAmount}
        eyeRefractionScale={v.eyeRefractionScale}
        lensDepth={v.lensDepth}
        lensDuration={v.lensDuration}
        colorSplash={v.colorSplash}
        ringStart={v.ringStart}
        ringEnd={v.ringEnd}
        className="rounded-2xl"
      />
    ),
  },
];

export const registryBySlug = new Map(registry.map((i) => [i.slug, i]));
export const categories: Category[] = ['Components', 'Effects'];
