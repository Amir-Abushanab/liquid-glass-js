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
in WebKit, since Chromium and Gecko resolve the origin correctly on their own and the
pin is not free: a transform makes an element the containing block for its own
`background-attachment: fixed`, which detaches a fixed backdrop from the viewport and
squeezes it into the element box. That is exactly the shape of the panes that clone
the page backdrop, so those are not pinned at all. They get the same correction
arithmetically instead — `glassOriginOffset()` adds the element's document position
to the filter's coordinates, WebKit's own frame of reference, which needs no scroll
tracking because the map scrolls with the page. Both the alpha chain (glass text and
marks) and the morph chain take it; the lens has no fixed backdrop, so it keeps the
cheaper pin.

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

Also: **`blur` now renders the same in all three engines**, which it never did. Every
displacement chain goes through one rule — all seven of them, where before only the
lens normalised anything at all.

Reading the sigma each engine actually applies off the rendered pixels (a Gaussian
smears a hard edge over a 10%-90% rise of 2.563 sigma), sampled every 0.1:

| stdDeviation | chromium | webkit | firefox      |
| ------------ | -------- | ------ | ------------ |
| 0            | 0        | 0      | 0            |
| 0.1 – 0.7    | 0        | 1.47   | 0 → 0.76     |
| 0.8 – 1.3    | 1.07     | 1.47   | 0.85 → 1.28  |
| 1.4 – 1.8    | 1.47     | 1.47   | 1.42 → 1.79  |
| 1.9 – 2.3    | 2.20     | 2.51   | 1.86 → 2.20  |
| 2.4 – 2.9    | 2.51     | 2.51   | 2.51         |
| 3.0 – 3.4    | 3.21     | 3.53   | 3.21         |
| 3.5 – 3.9    | 3.53     | 3.53   | 3.53         |

Nobody applies a Gaussian. The spec says to approximate one with three box blurs of
size `d = floor(s * 3 * sqrt(2*PI) / 4 + 0.5)`, and those plateaus are that
quantisation — every transition lands on an integer step of `d`, and the deliverable
sigma is `sqrt(d² - 1) / 2` and nothing between. What differs is which `d` each engine
will produce: **Chromium** any of them (`d <= 1` renders as nothing), **WebKit** odd
`d` only and never below 3 — which is why every value from 0.1 to 1.8 gives the
identical 1.47 there, and why Safari simply cannot blur by less than ~1.4px —
**Gecko** a real Gaussian below `d = 4`, box-quantised above it.

So the set all three can hit is WebKit's: 0, 1.414, 2.449, 3.464, 4.472, … The
requested blur is snapped to the nearest of those rungs and a `stdDeviation` emitted
that lands every engine on it. Verified by re-measuring: eighteen requested values
from 0 to 8, all three engines identical on every row (worst spread 0.03, inside the
measurement noise).

The cost is explicit. The rungs are ~1px apart, so `blur: 1` renders as 1.41
everywhere instead of 1.07 / 1.47 / 0.99 — there is no `stdDeviation` that makes
Safari blur by 1.0, so agreeing means moving to a value it can reach. Below 0.71 the
nearest rung is 0, which is where the old sub-pixel threshold went; it now falls out
of the same rule rather than being a separate cutoff.

That also fixes the colour half of it, which is how this was first found — WebKit
desaturates a partially transparent source the moment the blur is non-zero, same
plateaus, same edges, a premultiply round-trip rather than physics:

| stdDeviation | 0     | 0.2   | 0.35  | 0.5   | 0.75  | 1     | 2    |
| ------------ | ----- | ----- | ----- | ----- | ----- | ----- | ---- |
| webkit       | 124.1 | 95.9  | 95.9  | 95.9  | 95.9  | 95.9  | 82.3 |
| firefox      | 123.6 | 123.6 | 122.7 | 117.4 | 109.6 | 104.2 | 85.9 |
| chromium     | 123.8 | 123.8 | 123.8 | 123.8 | 123.8 | 102.7 | 86.0 |

A 0.4px blur nobody asked to see cost the emoji orb a quarter of its colour.

`preBlurStd()` zeroes the value rather than removing the primitive: measured through a
real chain, "no `feGaussianBlur` at all" and "`feGaussianBlur stdDeviation=0`" are
identical in every engine, so keeping it gives the chain one shape and lets a live
blur change stay a single `setAttribute`. It lives in `blur-quantize.ts` with the
measurements, and is exported — anyone hand-rolling a chain needs the same rule.

Also clips the WebGL canvas to the glass radius itself. The wrapper's overflow and
border-radius are enough for ordinary content, but a WebGL canvas is its own
compositing layer and Firefox does not clip a composited layer to an ancestor's
ROUNDED corners — only to its box — so it kept square corners overhanging the rim.

Unaffected and unchanged: `mountSvg` and `mountDomRefract` carry no subregion and
size their region in bbox units — which is why dom-refract was the one renderer
that already worked in Safari — and the `url()` frost path is Chromium-gated.

Both READMEs gain a **Gotchas** section — plain bullets, grouped by browser — for the
things the library can't fix from inside and for what it took to find them: Safari's
page-origin filter coordinates and the transform that fixes them (and the
fixed-attachment backdrop that transform breaks), its id-keyed filter cache, its
viewBox-unit coordinates on inline `<svg>`, composited layers being skipped by an
ancestor's filter and the two things that promote one, the canvas gradient that greys
out colour emoji; Firefox's square WebGL corners inside a rounded box and its washed
out `repeating-linear-gradient` hairlines; the box-quantised blur, `background-clip:
text` refusing to paint the parts of a glyph that reach outside the padding box (so
gradient-filled letterforms lose their descenders and it looks like the filter did it),
the filter bending rather than scaling, needing bleed outside the target, the
ink-vs-border bbox in `objectBoundingBox` units, `feImage` needing an explicit
subregion, canvas and video re-filtering every frame, `backdrop-filter: url()` parsing
everywhere and painting only in Chromium; and how to test any of it — not from a Safari
screenshot, not in any WebKit that isn't Safari (Playwright's lacks the cache and the
compositing rules, an embedded one in a dev tool can invent bugs Safari doesn't have),
and never against something that's animating.

Ships a [TanStack Intent](https://github.com/TanStack/intent) skill at
`packages/core/skills/liquid-glass/SKILL.md` (included in the published package), so
an agent picking up the library gets the component-selection guidance and these
pitfalls without rediscovering them.
