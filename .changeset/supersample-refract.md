---
'@liquidglassjs/core': minor
'@liquidglassjs/react': minor
'@liquidglassjs/element': minor
---

`supersample` (default 1 = off, clamp 3) on the live-DOM refract path: the
content lays out at its natural size, an inner `scale(G)` blows it up into the
filtered layer, and `scale(1/G)` brings the filtered result back down, so the
whole chain — source raster, blur, displacement, recomposite — runs on a G×
raster and displaced small text keeps its subpixel antialiasing. Chromium-only
(elsewhere the filter runs in software and G² pixels quadruple a slow path;
the option silently stays 1×), and it needs the standard
`__refract`/`__refract-inner` pair. Adapted from @samasante/liquid-glass's
`filterResolution`. Honest note: on a retina display with the flat-middle
profiles the difference is confined to the bent rim band — its niche is heavy
bend through text on 1× displays.
