# @liquidglassjs/qr

## 0.4.0

### Minor Changes

- [`ab147c1`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/ab147c132a4749019880422698fbc894a31bd36c) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Make the Glass QR's shape tunable — square modules, square eyes, square card.

  The QR's look was hardcoded three levels down: modules were a circle test in the
  fragment shader (`dot(d, d) < r2`), the finder eyes were three rounded rects with
  baked-in corner radii, and the card was a 56px/44px squircle in the stylesheet.
  A design system with sharp corners had nothing to pass — the only escape was
  `styles: false` plus CSS overrides, which still left round dots and squircle eyes.

  Four new options, all live-`reconfigure`-able (they're shader uniforms and one
  CSS variable, so nothing re-encodes or re-mounts):

  - **`moduleRadius`** — module corner rounding, `1` = circles (default) … `0` =
    sharp squares. The shader now draws each module as a rounded box; at `1` the
    corner radius equals the half-extent, so the SDF degenerates to the exact
    circle it drew before.
  - **`moduleScale`** — how much of its cell a module fills, 0…1. Default ≈0.7 (the
    classic gapped dots); `1` makes neighbours touch, like a printed QR.
  - **`eyeRadius`** — finder-eye corners, `0` = square … `1` = circle, as a fraction
    of each ring's half-size. Unset keeps the original radii (a fixed px step that
    doesn't scale with `size`); setting it switches every ring to proportional
    rounding, which does.
  - **`frameRadius`** — the card and tile radius; any CSS length, a number is px.
    It sets `--ps-qr-radius`, which the stylesheet now uses for the card and derives
    the tile's radius from (inset by the card's padding, clamped at 0). Consumers on
    `styles: false` get the same knob as long as they keep the var.

  Defaults are unchanged on every path: `moduleRadius: 1` is the same circle,
  `moduleScale`'s default is the same `cell / 2.85`, unset `eyeRadius` keeps the
  same radii, and the card still computes to 56px/44px.

### Patch Changes

- Updated dependencies []:
  - @liquidglassjs/core@0.4.0

## 0.3.0

### Minor Changes

- [`b8b84f4`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/b8b84f456dcc8105c36f57bbe1366f415c811fd7) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Let the Glass QR play its press animation on reveal, and expose it imperatively.

  **`playOnReveal` option.** The press choreography (refraction bloom + colour
  ripple + eye press + 360° logo spin) only fired on a click, so a QR that wanted an
  entrance flourish had no seam for it — and the animation lives in a private
  closure, so consumers couldn't trigger it either. Set `playOnReveal: true` and it
  fires once, the first time the QR scrolls into view (not on mount — a below-the-
  fold QR waits until it's actually revealed). It's gated on `prefers-reduced-motion`
  in JS, since the animation is WebGL/rAF-driven and the stylesheet's reduced-motion
  guard only covers the CSS tilt/spin transitions. Default false.

  **`handle.press()`.** The same choreography, now callable on the mount handle, so
  you can fire it from your own events. Decoupled from the logo button, so it works
  even with `logo: false` (nothing to click). `playOnReveal` is just this called
  once on first reveal.

- [`b8b84f4`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/b8b84f456dcc8105c36f57bbe1366f415c811fd7) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Let the Glass QR's interaction colours be the consumer's brand, not the built-in
  palette.

  **`splashColors` option.** The click ripple and the eyes' hover/press flashes
  cycled the library's hardcoded `SPLASH_COLORS` with no per-instance override, so
  an adopter theming a QR per brand (or per payment method) had no seam to pass
  their own colour through. Now `splashColors?: string[]` replaces the cycled
  palette in order; a single-element array (e.g. `['#1DB954']`) pins one fixed
  accent. Values must be `#RRGGBB` hex — the ripple trail and eye tint parse them
  as hex, so `rgb(…)`/`var(…)` don't belong here (unlike `dotColor`/`eyeColor`,
  which resolve through the canvas). Omitting it keeps the built-in palette.

  **`eyeColor` option.** The three eyes (finder patterns) took their resting colour
  from `dotColor`, so there was no way to give them their own tint. Now
  `eyeColor?: string` sets the resting eye colour and defaults to `dotColor`, so
  existing QRs are unchanged; it accepts any CSS colour, including `var(--…)`.

  Both are construction-time options — the React binding re-mounts when they
  change, alongside `value`/`dotColor`/the other structural props.

### Patch Changes

- Updated dependencies []:
  - @liquidglassjs/core@0.3.0

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
