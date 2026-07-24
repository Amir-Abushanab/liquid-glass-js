# @liquidglassjs/qr

## 0.2.0

### Minor Changes

- [`20eb1b6`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/20eb1b6f03d1729d935f851098d8a724e1adfe54) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Make the Glass QR's payload and branding the consumer's, not the author's.

  **`logo` option.** The centre mark was hardcoded to the built-in glass mark with
  no way to change it — for a QR, where the centre is inherently consumer-branded,
  that meant every adopter hit it immediately (and worked around it by reaching
  into `.ps-qr__logo-rotator`, an internal class). Now
  `logo?: string | Node | false`, defaulting to the built-in mark. `logo: false`
  drops the button entirely.

  **`reserveCenter` replaces `image`.** `image` only controlled whether the
  _geometry_ reserved the centre; the logo button rendered either way, so
  `image: false` produced a mark sitting on live modules. Center reservation now
  follows `logo` by default, and `reserveCenter` is the explicit override for the
  rare hole-without-a-mark case. `image` still works as a deprecated alias.

  **BREAKING (types): `value` is required.** It defaulted to
  `https://principlestash.com` — the author's own site. A QR silently encoding
  someone else's URL is the worst failure this package has, since the whole point
  of the element is the payload. `mountGlassQR(container, opts)` no longer accepts
  a missing `opts`. Callers already passing `value` need no change.

### Patch Changes

- [`20eb1b6`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/20eb1b6f03d1729d935f851098d8a724e1adfe54) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Fix Glass QR failure modes, and theme the frosted fallback from `--glass-paper`.

  **qr — a failed mount no longer strands DOM.** `mountGlassQR` appended its
  elements to the container _before_ constructing the WebGL2 renderer, so a
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

- Updated dependencies [[`20eb1b6`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/20eb1b6f03d1729d935f851098d8a724e1adfe54)]:
  - @liquidglassjs/core@0.2.0

## 0.1.1

### Patch Changes

- Updated dependencies [[`5568632`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/55686326ab2ccac64b7d17a7da890a9490ce4559)]:
  - @liquidglassjs/core@0.1.1
