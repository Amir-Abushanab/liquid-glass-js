---
'@liquidglassjs/core': patch
'@liquidglassjs/qr': patch
---

Fix Glass QR failure modes, and theme the frosted fallback from `--glass-paper`.

**qr — a failed mount no longer strands DOM.** `mountGlassQR` appended its
elements to the container *before* constructing the WebGL2 renderer, so a
browser without WebGL2 (Brave's fingerprinting shields, among others) got an
exception plus an empty `.ps-qr` left behind. Every fallible step of the mount
now unwinds its own DOM before rethrowing, which also covers the failures that
ordering alone wouldn't — a shader compile or link error, or a 2D context the
browser refuses.

**qr — `isGlassQRSupported()`.** A cached WebGL2 probe, so consumers can decide
whether to enhance at all instead of writing their own. It releases its probe
context (browsers cap live contexts) and returns `false` on the server without
caching, so the client re-probes after hydration. The degenerate
"geometry produced nothing" path now throws like the others rather than
returning a no-op handle over an empty box.

**qr — `nonce` and `styles` options.** The mount injects a `<style>` into
`document.head`, which a strict `style-src` CSP drops. Pass `nonce`, or import
the new `@liquidglassjs/qr/css` entry and mount with `styles: false`. The
built-in centre mark is now built with `createElementNS` instead of `innerHTML`,
so it also survives `require-trusted-types-for 'script'` — and its gradient ids
are per-instance, fixing two QRs on one page shadowing each other's `<defs>`.

**qr — `handle.dispose()`.** The handle stays callable, but now also carries a
named `dispose()`, matching `mountGlass`'s `GlassInstance` in core. Repeat
disposal is a no-op.

**core — `--glass-frost-bg` derives from `--glass-paper`.** It defaulted to a
hardcoded `rgb(255 255 255 / 55%)`, so the frosted fallback — the path most
consumers land on — rendered as a light slab on dark themes even after setting
`--glass-paper`. Now `color-mix(in srgb, var(--glass-paper, #fff) 55%, transparent)`,
matching what `glass.css` already did for the tint.
