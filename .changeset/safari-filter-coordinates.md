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

Also: the pre-blur is omitted below `stdDeviation` 0.75. WebKit
desaturates a partially transparent source the moment a blur primitive exists — the
full cost at 0.2, flat to 1.5, a premultiply round-trip rather than physics.
Measured on translucent colour emoji, mean saturation:

| stdDeviation | 0     | 0.2   | 0.35  | 0.5   | 0.75  | 1     | 2    |
| ------------ | ----- | ----- | ----- | ----- | ----- | ----- | ---- |
| webkit       | 124.1 | 95.9  | 95.9  | 95.9  | 95.9  | 95.9  | 82.3 |
| firefox      | 123.6 | 123.6 | 122.7 | 117.4 | 109.6 | 104.2 | 85.9 |
| chromium     | 123.8 | 123.8 | 123.8 | 123.8 | 123.8 | 102.7 | 86.0 |

This is a normalisation, not just a WebKit workaround: the three disagree entirely
about what a sub-pixel `stdDeviation` means. Chromium ignores it, WebKit charges the
full desaturation, and Gecko applies a real blur — visibly softer text at 0.4, the
lens default. One value producing three different pictures is worse than it
producing none, so it rounds down to no blur and the engines agree. Ask for >= 0.75
to get a blur in all three.

Unaffected and unchanged: `mountSvg` and `mountDomRefract` carry no subregion and
size their region in bbox units — which is why dom-refract was the one renderer
that already worked in Safari — and the `url()` frost path is Chromium-gated.

Both READMEs gain a **Gotchas** section for the things the library can't fix from
inside: Safari excluding a CSS-animated child from its ancestor's filter (animate
from script instead), Safari's screenshot path not matching its compositing path,
the filter bending rather than scaling, needing bleed outside the target, canvas and
video sources re-filtering every frame, `backdrop-filter: url()` parsing everywhere
but painting only in Chromium, and a canvas gradient greying out colour emoji.

Ships a [TanStack Intent](https://github.com/TanStack/intent) skill at
`packages/core/skills/liquid-glass/SKILL.md` (included in the published package), so
an agent picking up the library gets the component-selection guidance and these
pitfalls without rediscovering them.
