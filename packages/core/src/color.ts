// Parse any CSS colour string to normalized [r, g, b] in 0–1 via a 1×1 canvas,
// so whatever colour syntax the browser understands just works. Kept separate
// from map-encode.ts (which is DOM-free) and from qr/painting.ts (the core must
// not depend on the qr subpackage). Used by the glint tint (item 6).

export function parseCssColor(css: string): [number, number, number] {
  const cv = document.createElement('canvas');
  cv.width = 1;
  cv.height = 1;
  const ctx = cv.getContext('2d');
  if (!ctx) return [1, 1, 1];
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0] / 255, d[1] / 255, d[2] / 255];
}

// ── Shared palette + hex helpers (DOM-free) ──────────────────────────────────
// Aave's splash palette, cycled on every click. Shared by the SVG ripple bloom
// (svg-ripple.ts, core) and the Glass QR's painting texture (@liquidglassjs/qr),
// so it lives here — not in qr/painting — and core never imports the qr package.
export const SPLASH_COLORS = ['#9896FF', '#39D1F9', '#FFB400', '#FF3200'];

export function nextColor(c: string): string {
  const i = SPLASH_COLORS.indexOf(c);
  return SPLASH_COLORS[(i + 1) % SPLASH_COLORS.length];
}

// hex → [r,g,b] in 0..1, matching Aave's `b()`.
export function hexToRgb(hex: string): [number, number, number] {
  const t = hex.replace('#', '');
  return [
    parseInt(t.substring(0, 2), 16) / 255,
    parseInt(t.substring(2, 4), 16) / 255,
    parseInt(t.substring(4, 6), 16) / 255,
  ];
}
