---
'@liquidglassjs/core': patch
---

Fix every SVG glass renderer in Safari.

Three separate WebKit behaviours, each measured against Chromium and Firefox, each
of which silently broke glass in a different way.

**1. `userSpaceOnUse` coordinates resolve against the page origin.** WebKit resolves
both the filter region and any primitive subregion against the document origin
rather than the filtered element's own, unless that element establishes a
coordinate system. Measured on a 200×200 element at page (50,50), with a region at
`x=0 y=0` and an `feImage` subregion at `x=60 y=60`:

|          | subregion lands | region lands |
| -------- | --------------- | ------------ |
| webkit   | 60,60           | 0,0          |
| firefox  | 110,110         | 50,50        |
| chromium | 110,110         | 50,50        |

So each map went wherever the element sat in the document — further down the page,
further off. That one fact accounts for the lens appearing to split into a stuck
layer and a moving one, glass text and glass marks rendering as blank space (their
chain ends in `operator="in"` against `SourceAlpha`, so a map that landed elsewhere
clipped the result to nothing), and controls losing their backdrop while pressed.

Any transform-family property normalises it in every engine; `perspective` does
not, which is what identifies this as a coordinate-system question. `applyGlassFilter`
sets the `rotate` longhand — never clobbering a `transform` the page owns — and only
when the element has no transform-family property of its own. It costs nothing: an
element with a `filter` is already a stacking context and already a containing block.

**2. Filter output is cached by id.** Mutating a primitive's attributes under an
unchanged id leaves Safari painting the result it cached when that id was created,
so the per-frame paths froze: the lens stuck where it mounted, the ripple never
advanced past its pre-first-frame state (reading as no ripple at all), and a morph
surface wouldn't follow a drag. `refreshGlassFilter` renames the filter and
re-points the element, which is the only invalidation that works — measured live in
Safari, re-inserting the node and nudging the element both do nothing. Gated to
WebKit: renaming every frame measurably worsens the frame-time tail elsewhere
(firefox p90 8.9ms → 58.8ms, chromium 9.2ms → 16.6ms), and both re-run the filter
on an attribute change anyway. Callers skip frames where nothing actually moved.

**3. On an inline `<svg>`, every filter coordinate is read in viewBox units.**
Region and primitives alike, where the other engines use CSS px. On a 64-unit
viewBox drawn at 200px (3.125×): an `feImage` subregion at `x=20 y=20 100×100`
landed at 112,112 sized 138, and `feOffset dx=20` — a pure length — shifted 63px
instead of 20. Glass marks got their map drawn oversized and offset, losing the rim
glint and showing a dark misplaced crescent, with displacement and blur inflated to
match. `primitiveScale()` multiplies by `viewBoxWidth / cssWidth` to cancel it,
returning 1 for HTML targets, for an `<svg>` without a viewBox, and for a viewBox
already in CSS px.

Also: the pre-blur is now omitted below `stdDeviation` 0.75. WebKit desaturates a
partially transparent source the moment a blur primitive exists — the full cost at
0.2, flat to 1.5, a premultiply round-trip rather than physics — while Chromium
doesn't move until 0.75. Measured on translucent colour emoji, mean saturation
124.1 → 95.9 in WebKit at 0.2, unchanged in Chromium. Below the threshold the
primitive is a no-op in engines that blur correctly, so dropping it renders
identically there and stops Safari paying for a blur nobody asked for.

Unaffected and unchanged: `mountSvg` and `mountDomRefract` carry no subregion and
size their region in bbox units — which is why dom-refract was the one renderer
that already worked in Safari — and the `url()` frost path is Chromium-gated.

Both READMEs now document the one thing this can't fix from inside the library:
Safari excludes an element with a running CSS transform animation from its
ancestor's filter, so animate children of a glass element from script instead.
