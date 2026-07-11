// @liquidglassjs/qr — the interactive Glass QR, built on @liquidglassjs/core.
//
// A separate package because it's the ONE thing that pulls in the `qrcode` npm
// dependency (via ./geometry), so @liquidglassjs/core consumers never install it.

export { mountGlassQR } from './GlassQR';
export type { GlassQROptions, GlassQRParams, GlassQRHandle } from './GlassQR';

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
