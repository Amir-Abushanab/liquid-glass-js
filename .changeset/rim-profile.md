---
'@liquidglassjs/core': minor
'@liquidglassjs/react': minor
'@liquidglassjs/element': minor
---

Add `profile: 'erf' | 'circle'` — the rim's falloff curve — to every
rounded-rect surface (mount, lens, loupe, button, dropdown, the element's
attribute, and the React bindings).

`'circle'` is the quarter-circle bevel `i = 1 − √(1 − t²)` on the outer SDF:
displacement peaks at exactly 100% at the rim with a vertical tangent — the
crisp iOS-style compression ring — and lands at zero at the depth band's inner
edge, so nothing leaks inward and mid-panel text stays undistorted however hard
the rim bends. It is the curve Kyant0's AndroidLiquidGlass screenshot-verified
against iOS 26, and the shape kube.io's ray-traced Snell maps arrive at from
first principles. `'erf'` stays the default and is byte-identical to what the
library has always rendered: a soft meniscus that reaches ~0.92 at the rim and
bleeds about two band-widths into the interior.

`profile` is a map input — reconfiguring it re-encodes the PNG — so it joins
the map-key lists everywhere `reconfigure()` exists.
