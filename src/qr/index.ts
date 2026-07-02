// @amir-abushanab/liquid-glass/qr — the interactive Glass QR (its own entry/chunk).
//
// This is the ONE thing that pulls in the `qrcode` npm dependency (via
// ./geometry). Keeping it on its own entry means core consumers never bundle it.

export { mountGlassQR } from './GlassQR';
export type { GlassQROptions, GlassQRParams, GlassQRHandle } from './GlassQR';

// Lower-level pieces (escape-hatch / advanced use)
export { QRGlassRenderer } from './renderer';
export type { QRRendererOptions } from './renderer';
export { buildQRGeometry } from './geometry';
export type { Eye, QRGeometry, QRGeometryOptions } from './geometry';
export { PaintingTexture, SPLASH_COLORS, hexToRgb, nextColor, EC_RADIUS } from './painting';
export type { PaintingOptions } from './painting';
export { LensGenerator } from './lens';
export type { LensOptions } from './lens';
