// The Glass QR's stylesheet — the single source of truth.
//
// `src/css/qr.css` is GENERATED from `QR_CSS` below by scripts/sync-qr-css.mjs
// (wired into this package's `prepack`), so the `@liquidglassjs/qr/css` entry and
// the runtime injection can never drift. Edit the constant, not the .css file.
//
// Why both paths exist: mounting injects a <style> into document.head, which a
// strict `style-src` CSP blocks. Consumers under such a policy either pass a
// `nonce`, or import the stylesheet and mount with `styles: false`.

export const QR_CSS = `.ps-qr { perspective: 50rem; display: inline-block; touch-action: manipulation; }
.ps-qr__tilt { transform-style: preserve-3d; will-change: transform; }
.ps-qr__stage {
  position: relative; border-radius: 56px; padding: 0.75rem;
  background: color-mix(in srgb, var(--ink, #0a0a0a) 6%, transparent);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--ink, #0a0a0a) 10%, transparent),
    inset 0 1px 1px color-mix(in srgb, white 55%, transparent),
    0 30px 70px -30px rgb(0 0 0 / 45%);
}
.ps-qr__box { position: relative; border-radius: 44px; overflow: hidden; }
.ps-qr__color, .ps-qr__qr { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.ps-qr__color { z-index: 1; }
.ps-qr__qr { z-index: 2; }
.ps-qr__logo {
  position: absolute; z-index: 3; left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  border: 0; padding: 0; background: none; cursor: pointer;
  -webkit-tap-highlight-color: transparent; transform-style: preserve-3d;
}
.ps-qr__logo:focus-visible { outline: 2px solid var(--ink, #0a0a0a); outline-offset: 4px; border-radius: 16px; }
.ps-qr__logo-rotator { transform-style: preserve-3d; will-change: transform; }
@media (prefers-reduced-motion: reduce) {
  .ps-qr__tilt, .ps-qr__logo-rotator { transition: none; }
}`;

let injected = false;

/**
 * Inject the Glass QR stylesheet once per document.
 *
 * Skipped entirely when the consumer already provides the CSS — either via the
 * `@liquidglassjs/qr/css` entry (pass `styles: false` to `mountGlassQR`) or via
 * a `<style data-psqr>` / `<link data-psqr>` already in the document. The marker
 * check also keeps duplicate bundle copies of this module from double-injecting.
 */
export function injectStyles(nonce?: string): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  if (document.querySelector('style[data-psqr], link[data-psqr]')) return;
  const style = document.createElement('style');
  style.dataset.psqr = '';
  // A CSP with `style-src 'nonce-…'` drops this element without the nonce.
  if (nonce) style.setAttribute('nonce', nonce);
  style.textContent = QR_CSS;
  document.head.appendChild(style);
}
