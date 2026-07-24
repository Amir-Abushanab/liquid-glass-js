// Types for the side-effect stylesheet export (`import "@liquidglassjs/qr/css"`).
// The stylesheet has no runtime exports — this type-only marker just makes the
// subpath a module so strict TypeScript resolves the side-effect import (otherwise
// TS2882). Import it and pass `styles: false` to mountGlassQR when a strict CSP
// forbids the runtime <style> injection.
export type GlassQrCss = void;
