// @amir-abushanab/liquid-glass — core entry (SVG-first).
//
// This module contains the framework-agnostic mount + every SVG-path renderer.
// It NEVER statically imports the WebGL renderer or the QR: those are separate
// entries (`@amir-abushanab/liquid-glass/webgl`, `@amir-abushanab/liquid-glass/qr`) and the
// WebGL path is lazy-imported at runtime inside `mountGlass`, so a consumer who
// only touches this entry ships zero WebGL / zero `qrcode`.
//
// Styling ships separately — import `@amir-abushanab/liquid-glass/css` once.

// Unified surface + framework-agnostic mount
export {
  mountGlass,
  mountGlassFromData,
  readGlassOptions,
  GLASS_DEFAULTS,
} from './mount';
export type { GlassOptions, GlassInstance } from './mount';

// Displacement-map generator (SDF rounded-rect dome; R/G/B encoding)
export { buildDisplacementMap, renderDisplacementMap, computeDomeConstants } from './displacement';
export type { GlassMapOptions } from './displacement';

// Moving SVG lens over live DOM
export { mountGlassLens } from './glass-lens';
export type { GlassLensOptions, GlassLensParams, GlassLens } from './glass-lens';

// Ripple-button bloom (animated SVG filter)
export { mountSvgRipple } from './svg-ripple';
export type { SvgRippleParams, SvgRippleOptions } from './svg-ripple';

// Glyph-shaped displacement map (text)
export { buildGlyphDisplacementMap } from './glyph-map';
export type { GlyphMapOptions, GlyphMap, GlyphMapCache } from './glyph-map';

// Liquid-glass letterforms over live DOM
export {
  mountGlassText,
  reconfigureAllGlassText,
  GLASS_TEXT_DEFAULTS,
  glassTextInstances,
} from './glass-text';
export type { GlassTextParams, GlassTextOptions, GlassText } from './glass-text';

// Overshoot easing (used by switch/segmented snaps)
export { cubicBezier } from './dynamics';
