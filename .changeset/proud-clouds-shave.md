---
'@liquidglassjs/qr': minor
---

Make the Glass QR's shape tunable — square modules, square eyes, square card.

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
