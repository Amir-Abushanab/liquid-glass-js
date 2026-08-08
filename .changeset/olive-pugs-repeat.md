---
'@liquidglassjs/core': minor
---

Stop the glass erasing content on WebKit, and tell the truth about browser support.

The refraction is Chromium-only, and has been all along. Every renderer here
delivers its displacement map the same way — rasterize a dome field to a PNG data
URI, hand it to the filter via `<feImage>` — and that primitive is the single point
all the glass depends on. Measured with a red-over-blue tell (an opaque red map
composited `over` a blue box, so a red result means the map arrived), across
Playwright 1.61's webkit-2311 and firefox-1532:

| variant | webkit | firefox | chromium |
| --- | --- | --- | --- |
| feImage data-uri, userSpaceOnUse (what shipped) | 127,0,128 | 0,0,255 | pass |
| feImage data-uri, default units | 223,0,32 | 0,0,255 | pass |
| feImage → `#element` reference | 125,0,130 | 0,0,255 | pass |
| feFlood only (control) | pass | pass | pass |

The control passing everywhere is the point: filters themselves work in all three
engines. It is this one primitive.

Why it hid for so long: a map that never arrives leaves `feDisplacementMap` a
neutral grey field, which displaces by exactly zero. The surface still blurs and
tints, so it goes on *looking* like glass while it has quietly stopped bending —
and any check that asks "did the filter apply?" passes. That is how the previous
note that `filter: url()` "works fine in all three engines" came to be written; it
is true of the filter and false of the map.

On WebKit it was worse than cosmetic. The alpha-shaped renderers finish with
`feComposite operator="in"` against `SourceAlpha`; with an empty lit result that
clip yields nothing, so the element's own content **disappeared** — glass text,
glass marks and the frosted cards all rendering as blank space. The showcase's hero
wordmark was simply absent in Safari.

So the same engine gate that already gated `backdrop-filter: url()` now gates the
displacement path (`engine.ts`, shared by both). Where the map can't arrive the
renderers leave the target unfiltered: `mountGlassText`, `mountGlassShape`,
`mountGlassLens`, `mountGlassLoupe`, `mountGlassButton`/`Dropdown`, `mountSvgRipple`
and `mountGlass`'s DOM-refract path all render their content plainly, and
`mountGlass`'s `auto` mode prefers frost — a real blur — over an SVG path that can
only no-op. An explicit `mode: 'svg'` is still honoured, since asking for it is a
choice. `supportsDisplacementMaps()` is exported for consumers who want to branch.

Both failure directions stay safe: a false negative renders content plainly, and a
false positive is what every non-Chromium engine did already.
