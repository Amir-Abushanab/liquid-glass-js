// @liquidglassjs/core — core entry (SVG-first).
//
// This module contains the framework-agnostic mount + every SVG-path renderer.
// It NEVER statically imports the WebGL renderer — that's a separate subpath
// (`@liquidglassjs/core/webgl`), lazy-imported at runtime inside `mountGlass`, so
// a consumer who only touches this entry ships zero WebGL. The Glass QR is a
// separate package entirely (`@liquidglassjs/qr`, the only one needing `qrcode`).
//
// Styling ships separately — import `@liquidglassjs/core/css` once.

// Unified surface + framework-agnostic mount
export { mountGlass, mountGlassFromData, readGlassOptions, GLASS_DEFAULTS } from './mount';
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

// Alpha-mask glass surfaces — refraction + frost on arbitrary alpha (buttons, dropdowns)
export { mountGlassButton, mountGlassDropdown, GLASS_SURFACE_DEFAULTS } from './glass-morph';
export type {
  GlassSurfaceParams,
  GlassSurfaceOptions,
  GlassSurface,
  GlassButtonOptions,
  GlassButton,
  GlassDropdownOptions,
  GlassDropdown,
} from './glass-morph';

// Liquid glass on an arbitrary shape (image / canvas / SVG alpha)
export { mountGlassShape, GLASS_SHAPE_DEFAULTS } from './glass-shape';
export type {
  GlassShapeParams,
  GlassShapeSource,
  GlassShapeOptions,
  GlassShape,
} from './glass-shape';

// Overshoot easing (used by switch/segmented snaps)
export { cubicBezier } from './dynamics';

// Shared colour utilities (hex/palette helpers; also consumed by @liquidglassjs/qr)
export { hexToRgb, SPLASH_COLORS, nextColor } from './color';
