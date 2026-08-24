---
'@liquidglassjs/core': patch
---

Clip the WebGL canvas with `clip-path`, not only `border-radius`.

A canvas is its own compositing layer, and Firefox clips composited layers to
the ancestor's box but never its rounded corners — the long-documented gotcha.
The old mitigation (`border-radius: inherit` on the canvas itself) has stopped
holding in current Firefox: the composited layer ships square anyway, and the
WebGL card's dark corners overhang the glass rim. The canvas now also carries
`clip-path: inset(0 round var(--g-radius))` — a real geometric clip no
compositor shortcut can skip, honoured for composited layers in every engine.
