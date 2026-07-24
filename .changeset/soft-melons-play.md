---
'@liquidglassjs/qr': minor
---

Let the Glass QR play its press animation on reveal, and expose it imperatively.

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
