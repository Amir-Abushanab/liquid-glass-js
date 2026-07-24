---
'@liquidglassjs/qr': minor
---

Let the Glass QR's interaction colours be the consumer's brand, not the built-in
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
