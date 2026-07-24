// @liquidglassjs/qr — the interactive Glass QR, built on @liquidglassjs/core.
//
// A separate package because it's the ONE thing that pulls in the `qrcode` npm
// dependency (via ./geometry), so @liquidglassjs/core consumers never install it.

export { mountGlassQR } from './GlassQR';
export type { GlassQROptions, GlassQRParams, GlassQRHandle } from './GlassQR';

// Capability probe — mountGlassQR throws without WebGL2, so gate on this and
// keep a plain QR as the fallback (the payload has to stay reachable).
export { isGlassQRSupported } from './renderer';

// Styling: the stylesheet is injected on mount unless you opt out with
// `styles: false` and import "@liquidglassjs/qr/css" instead.
export { QR_CSS } from './styles';
export { defaultLogo } from './logo';

// Lower-level pieces (escape-hatch / advanced use)
export { QRGlassRenderer } from './renderer';
export type { QRRendererOptions } from './renderer';
export { buildQRGeometry } from './geometry';
export type { Eye, QRGeometry, QRGeometryOptions } from './geometry';
export { PaintingTexture, EC_RADIUS } from './painting';
export { SPLASH_COLORS, hexToRgb, nextColor } from '@liquidglassjs/core';
export type { PaintingOptions } from './painting';
export { LensGenerator } from './lens';
export type { LensOptions } from './lens';
