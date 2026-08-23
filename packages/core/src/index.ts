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
// Exported for the same reason as the map builder: anyone hand-rolling a displacement
// chain has to normalise the pre-blur or their sub-pixel `blur` renders three different
// pictures in three engines. See filter-origin.ts for the measurements.
export { preBlurStd } from './blur-quantize';
export type { GlassMapOptions, MapProfile } from './displacement';

// Merged glass: several elements fused into one smooth-min displacement map
export { mountGlassGroup } from './glass-group';
export type { GlassGroup, GlassGroupOptions, GlassGroupParams } from './glass-group';
export { buildGroupDisplacementMap, renderGroupDisplacementMap } from './group-map';
export type { GroupShape, GroupMapOptions } from './group-map';

// Scalar spring for driving the cheap per-frame knobs (setDisplScale, drag chases)
export { createSpring } from './dynamics';
export type { SpringHandle } from './dynamics';

// Moving SVG lens over live DOM
export { mountGlassLens } from './glass-lens';
export type { GlassLensOptions, GlassLensParams, GlassLens } from './glass-lens';

// iOS-style magnifying loupe (lens over a scaled live-DOM clone)
export { mountGlassLoupe, GLASS_LOUPE_DEFAULTS } from './glass-loupe';
export type {
  GlassLoupeParams,
  GlassLoupeOptions,
  GlassLoupeTrigger,
  GlassLoupeSample,
  GlassLoupe,
} from './glass-loupe';

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
export { glassTween } from './glass-tween';
export type { GlassTween, GlassTweenOptions, GlassTweenTarget } from './glass-tween';

// Shared colour utilities (hex/palette helpers; also consumed by @liquidglassjs/qr)
export { hexToRgb, SPLASH_COLORS, nextColor } from './color';
