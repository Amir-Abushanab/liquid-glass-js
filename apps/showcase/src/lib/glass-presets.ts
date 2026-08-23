// One place for every glass parameter this site ships.
//
// There used to be two: the vanilla showcase declared its tuner sliders and its mount
// options in scripts/showcase.js, and the registry declared the same numbers again as
// TuneConfig defaults in lib/registry.tsx. They drifted — the glass mark's chroma and
// dome, the loupe's strength and chroma — and a retune had to be applied twice or the
// registry's Code tab handed people values nobody had looked at.
//
// So: a control here carries its range AND its default, and both surfaces read it.
// A consumer that shows fewer sliders passes a `pick` list; that is a decision about
// which knobs to expose, not about what a knob is worth, so it stays local.
//
// Rules of thumb when editing:
//   - The default is the shipped look. Change it here and it changes everywhere.
//   - Ranges are the union of what the two used to allow, so no existing value snaps.
//   - `step` has to be able to express the default. A step of 0.1 quietly rounds a
//     0.15 default to 0.2 in the slider and in the generated snippet.

import { GLASS_TEXT_DEFAULTS } from '@liquidglassjs/core';

export interface GlassControl {
  key: string;
  /** Shown instead of `key` when the parameter name is opaque out of context. */
  label?: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

/**
 * `mountGlassText` is the one component whose showcase values ARE the library
 * defaults — nothing overrides them — so the library stays the single source and this
 * only supplies the ranges.
 */
const fromLibrary = (
  controls: Omit<GlassControl, 'default'>[],
  defaults: Record<string, number>,
): GlassControl[] => controls.map((c) => ({ ...c, default: defaults[c.key] ?? 0 }));

export const GLASS_PRESETS = {
  // Glass letterforms. Displacement turned almost off, shaping turned up — at display
  // sizes a strong bend fights the counters and the type stops reading as type.
  text: fromLibrary(
    [
      { key: 'strength', min: 0, max: 20, step: 0.5 },
      { key: 'chroma', min: 0, max: 1, step: 0.02 },
      { key: 'blur', min: 0, max: 3, step: 0.05 },
      { key: 'bevel', min: 0.5, max: 10, step: 0.1 },
      { key: 'dome', min: 0, max: 12, step: 0.5 },
      { key: 'edge', min: 0, max: 1.5, step: 0.05 },
      { key: 'glow', min: 0, max: 1, step: 0.05 },
      { key: 'shade', min: 0, max: 1, step: 0.05 },
    ],
    {
      ...(GLASS_TEXT_DEFAULTS as unknown as Record<string, number>),
      // The stage text eases 4 -> 12.5 on hover, so it has to REST at 4; at the
      // library's 0.5 the first hover-out would settle somewhere it never started.
      // The one place this page departs from the shipped text defaults, and only
      // because it is demonstrating something the defaults don't.
      strength: 4,
    },
  ),

  // Glass shaped like a logo, mark or emoji. Same param set as text, wider ranges and
  // its own defaults: arbitrary artwork wants the refraction that letterforms don't.
  shape: [
    { key: 'strength', min: 0, max: 40, step: 0.5, default: 6 },
    { key: 'chroma', min: 0, max: 1.5, step: 0.02, default: 0.4 },
    { key: 'blur', min: 0, max: 3, step: 0.05, default: 0.3 },
    { key: 'bevel', min: 0.5, max: 10, step: 0.1, default: 3.2 },
    { key: 'dome', min: 0, max: 30, step: 0.5, default: 5 },
    { key: 'edge', min: 0, max: 2, step: 0.05, default: 1 },
    { key: 'glow', min: 0, max: 2, step: 0.05, default: 0.4 },
    { key: 'shade', min: 0, max: 2, step: 0.05, default: 0 },
  ],

  // The draggable lens. `radius` is only meaningful where the consumer owns the lens
  // box, so the registry's lens page (which derives it from the lens size) omits it.
  lens: [
    { key: 'strength', min: 0, max: 40, step: 0.5, default: 11 },
    { key: 'chroma', min: 0, max: 1.5, step: 0.02, default: 1.5 },
    { key: 'blur', min: 0, max: 4, step: 0.05, default: 0.55 },
    { key: 'dome', min: 0, max: 30, step: 0.5, default: 30 },
    { key: 'depth', min: 0, max: 30, step: 0.5, default: 5 },
    { key: 'radius', min: 0, max: 80, step: 1, default: 60 },
    { key: 'edge', min: 0, max: 2, step: 0.05, default: 1 },
    { key: 'glow', min: 0, max: 2, step: 0.05, default: 1 },
    { key: 'shade', min: 0, max: 1, step: 0.05, default: 1 },
  ],

  // The emoji orb: a lens like the one above, but parked over a dense little sphere
  // of glyphs rather than a card, so it carries a lot more bend and a hard rim.
  orb: [
    { key: 'strength', min: 0, max: 40, step: 0.5, default: 30 },
    { key: 'chroma', min: 0, max: 1.5, step: 0.02, default: 1 },
    { key: 'blur', min: 0, max: 4, step: 0.05, default: 0.1 },
    { key: 'dome', min: 0, max: 30, step: 0.5, default: 11.5 },
    { key: 'depth', min: 0, max: 30, step: 0.5, default: 18.5 },
    { key: 'radius', min: 0, max: 80, step: 1, default: 80 },
    { key: 'edge', min: 0, max: 2, step: 0.05, default: 2 },
    { key: 'glow', min: 0, max: 2, step: 0.05, default: 0.3 },
    { key: 'shade', min: 0, max: 1, step: 0.05, default: 0.15 },
  ],

  // The iOS press-and-hold magnifier: lens refraction plus its own geometry.
  loupe: [
    { key: 'zoom', min: 1.1, max: 3, step: 0.05, default: 3 },
    { key: 'longPressMs', label: 'hold', min: 0, max: 900, step: 20, default: 400 },
    { key: 'width', min: 60, max: 260, step: 2, default: 156 },
    { key: 'height', min: 28, max: 120, step: 2, default: 50 },
    { key: 'radius', min: 0, max: 60, step: 1, default: 25 },
    { key: 'offsetY', min: -140, max: 0, step: 2, default: -58 },
    { key: 'strength', min: 0, max: 30, step: 0.5, default: 17 },
    { key: 'chroma', min: 0, max: 1.5, step: 0.02, default: 0.2 },
    { key: 'blur', min: 0, max: 2, step: 0.05, default: 0.15 },
    { key: 'dome', min: 0, max: 24, step: 0.5, default: 8 },
    { key: 'depth', min: 0, max: 30, step: 0.5, default: 5 },
    { key: 'edge', min: 0, max: 2, step: 0.05, default: 0.9 },
    { key: 'glow', min: 0, max: 2, step: 0.05, default: 0.4 },
    { key: 'shade', min: 0, max: 1, step: 0.05, default: 0.12 },
  ],

  // `mountGlass` — the unified surface behind the Render paths trio and <GlassSurface>.
  surface: [
    { key: 'strength', min: 0, max: 40, step: 0.5, default: 15 },
    { key: 'chroma', min: 0, max: 1.5, step: 0.02, default: 1 },
    { key: 'blur', min: 0, max: 10, step: 0.05, default: 0.15 },
    { key: 'dome', min: 0, max: 30, step: 0.5, default: 30 },
    { key: 'depth', min: 0, max: 30, step: 0.5, default: 26 },
    { key: 'edge', min: 0, max: 2, step: 0.05, default: 2 },
    { key: 'glow', min: 0, max: 2, step: 0.05, default: 0.2 },
    { key: 'spec', min: 0, max: 1.5, step: 0.02, default: 0.9 },
    { key: 'tint', min: 0, max: 40, step: 1, default: 12 },
    { key: 'vibrancy', min: 0, max: 1, step: 0.02, default: 0.15 },
  ],

  // The morphing glass button/dropdown surface. `radius` is left out of what the
  // showcase passes — that button takes its corner from CSS.
  button: [
    { key: 'strength', min: 0, max: 40, step: 0.5, default: 40 },
    { key: 'chroma', min: 0, max: 1.5, step: 0.02, default: 1 },
    { key: 'blur', min: 0, max: 3, step: 0.05, default: 0.4 },
    { key: 'dome', min: 0, max: 30, step: 0.5, default: 13 },
    { key: 'depth', min: 0, max: 30, step: 0.5, default: 10 },
    { key: 'edge', min: 0, max: 2, step: 0.05, default: 0.9 },
    { key: 'glow', min: 0, max: 2, step: 0.05, default: 0.3 },
    { key: 'spec', min: 0, max: 1.5, step: 0.02, default: 0.7 },
    { key: 'radius', min: 0, max: 40, step: 1, default: 16 },
    { key: 'duration', label: 'morph ms', min: 100, max: 1000, step: 20, default: 460 },
    { key: 'pulse', min: 0, max: 1, step: 0.05, default: 0.55 },
  ],

  // The press ripple.
  ripple: [
    { key: 'strength', min: 0, max: 60, step: 1, default: 60 },
    { key: 'chroma', min: 0, max: 1.5, step: 0.02, default: 1 },
    { key: 'spec', min: 0, max: 1.5, step: 0.02, default: 1 },
    { key: 'blur', min: 0, max: 3, step: 0.05, default: 0.6 },
    { key: 'maxFrac', label: 'reach', min: 0.2, max: 1.5, step: 0.02, default: 0.9 },
    { key: 'duration', label: 'ms', min: 200, max: 3000, step: 50, default: 1500 },
  ],

  // The WebGL QR shader — its own vocabulary, nothing shared with the SVG paths.
  qr: [
    { key: 'moduleRadius', label: 'dot radius', min: 0, max: 1, step: 0.05, default: 1 },
    { key: 'moduleScale', label: 'dot size', min: 0.3, max: 1, step: 0.02, default: 0.7 },
    { key: 'eyeRadius', label: 'eye radius', min: 0, max: 1, step: 0.05, default: 0.55 },
    { key: 'frameRadius', label: 'frame radius', min: 0, max: 56, step: 1, default: 56 },
    { key: 'scaleX', min: 0, max: 0.25, step: 0.005, default: 0.08 },
    { key: 'scaleY', min: 0, max: 0.25, step: 0.005, default: 0.08 },
    { key: 'chromaAmount', label: 'chroma', min: 0, max: 3, step: 0.05, default: 1 },
    { key: 'eyeRefractionScale', label: 'eye refract', min: 0, max: 1, step: 0.02, default: 0.16 },
    { key: 'lensDepth', label: 'depth', min: 0, max: 80, step: 1, default: 30 },
    { key: 'lensDuration', label: 'bloom ms', min: 1000, max: 12000, step: 250, default: 6000 },
    { key: 'colorSplash', label: 'splash', min: 50, max: 1000, step: 10, default: 300 },
    { key: 'ringStart', label: 'ring start', min: 0, max: 1, step: 0.05, default: 0.15 },
    { key: 'ringEnd', label: 'ring end', min: 0, max: 1, step: 0.05, default: 0.9 },
  ],

  // The glass-on-interaction controls: solid at rest, glass while dragged. A thumb is
  // a fraction of the size of the lens above and dome/depth are px, so these do not
  // inherit the lens preset. Shared by the showcase's slider and switch and by the
  // registry shells of the same name.
  slider: [
    { key: 'strength', min: 0, max: 40, step: 0.5, default: 11 },
    { key: 'chroma', min: 0, max: 1.5, step: 0.02, default: 0.32 },
    { key: 'dome', min: 0, max: 30, step: 0.5, default: 12 },
    { key: 'depth', min: 0, max: 30, step: 0.5, default: 8 },
    { key: 'edge', min: 0, max: 2, step: 0.05, default: 0.9 },
    { key: 'glow', min: 0, max: 2, step: 0.05, default: 0.3 },
  ],
  switch: [
    { key: 'strength', min: 0, max: 40, step: 0.5, default: 14 },
    { key: 'chroma', min: 0, max: 1.5, step: 0.02, default: 0.4 },
    { key: 'dome', min: 0, max: 30, step: 0.5, default: 8 },
    { key: 'depth', min: 0, max: 30, step: 0.5, default: 5 },
    { key: 'edge', min: 0, max: 2, step: 0.05, default: 0.9 },
    { key: 'glow', min: 0, max: 2, step: 0.05, default: 0.32 },
  ],

  // Merged glass — the Lens stage's lens + blob, and the registry's Glass
  // Merge pills. `blend` is the fuse distance; silhouettes bridge at a gap of
  // about half of it.
  merge: [
    { key: 'blend', min: 0, max: 64, step: 1, default: 28 },
    { key: 'strength', min: 0, max: 40, step: 0.5, default: 20 },
    { key: 'chroma', min: 0, max: 1, step: 0.02, default: 0.4 },
    { key: 'depth', min: 1, max: 30, step: 0.5, default: 12 },
    { key: 'edge', min: 0, max: 1.5, step: 0.05, default: 0.9 },
    { key: 'glow', min: 0, max: 1, step: 0.05, default: 0.3 },
    { key: 'shade', min: 0, max: 1, step: 0.05, default: 0.35 },
    { key: 'blur', min: 0, max: 3, step: 0.05, default: 0.4 },
  ],
} satisfies Record<string, GlassControl[]>;

export type GlassPresetId = keyof typeof GLASS_PRESETS;

/**
 * The controls for `id`, optionally narrowed to `pick` — in `pick`'s order, so a
 * surface can also reorder its sliders. An unknown key in `pick` throws rather than
 * silently vanishing from the panel.
 */
export function presetControls(id: GlassPresetId, pick?: readonly string[]): GlassControl[] {
  const all = GLASS_PRESETS[id] as GlassControl[];
  if (!pick) return all;
  return pick.map((k) => {
    const c = all.find((x) => x.key === k);
    if (!c) throw new Error(`glass preset "${id}" has no control "${k}"`);
    return c;
  });
}

/** `{ strength: 11, … }` for `id`, optionally narrowed to `pick`. */
export function presetDefaults(
  id: GlassPresetId,
  pick?: readonly string[],
): Record<string, number> {
  return Object.fromEntries(presetControls(id, pick).map((c) => [c.key, c.default]));
}
