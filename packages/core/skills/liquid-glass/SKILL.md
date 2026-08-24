---
name: liquid-glass
description: >
  Add Apple-style liquid glass — real refraction, not a blur — to a website via the
  @liquidglassjs packages: @liquidglassjs/core (mountGlass, mountGlassLens,
  mountGlassText, mountGlassShape, mountGlassLoupe, mountGlassButton/Dropdown,
  mountGlassGroup, mountSvgRipple), @liquidglassjs/react, @liquidglassjs/element
  (<liquid-glass>) or
  @liquidglassjs/qr. Load this when a user wants a glass card/panel/navbar, a
  draggable magnifying lens or iOS press-and-hold text loupe, glass letterforms, glass
  shaped like a logo or image, glass buttons/switches/dropdowns with a ripple,
  glass shapes that MERGE like droplets when they approach, a glass QR code, or
  asks why their glass looks flat, blank or unrefracted in Safari.
metadata:
  type: core
  library: '@liquidglassjs/core'
  library_version: '0.4.0'
sources:
  - 'Amir-Abushanab/liquid-glass-js:README.md'
  - 'Amir-Abushanab/liquid-glass-js:packages/core/src/mount.ts'
  - 'Amir-Abushanab/liquid-glass-js:packages/core/src/glass-lens.ts'
  - 'Amir-Abushanab/liquid-glass-js:packages/core/src/glass-loupe.ts'
  - 'Amir-Abushanab/liquid-glass-js:packages/core/src/filter-origin.ts'
  - 'Amir-Abushanab/liquid-glass-js:packages/core/src/glass-morph.ts'
  - 'Amir-Abushanab/liquid-glass-js:packages/core/src/displacement.ts'
  - 'Amir-Abushanab/liquid-glass-js:packages/core/src/glass-group.ts'
---

# @liquidglassjs — real refraction on live DOM

The glass is an SVG `feDisplacementMap` applied to content the browser has already
rendered. Pixels are **bent**, not blurred: text under the glass stays selectable,
links stay clickable, and the DOM underneath is untouched. That's the whole design —
a `backdrop-filter: blur()` panel is a frosted slab, this is a lens.

One consequence to internalise before choosing anything: **the filter can displace
but never scale.** Magnification has to come from elsewhere (see the loupe).

## Choosing a component

| Want                                            | Use                                       | Refracts                            |
| ----------------------------------------------- | ----------------------------------------- | ----------------------------------- |
| A glass card / panel / navbar over page content | `mountGlass({ refract })`                 | the live DOM you point it at        |
| A bar floating over content it doesn't own      | `mountGlass({ behind })`                  | the live page (engine-dependent)    |
| A lens that moves across a surface              | `mountGlass` → `mountGlassLens`           | whatever it's parked over           |
| iOS press-and-hold text magnifier               | `mountGlassLoupe`                         | a scaled clone (real magnification) |
| Letterforms made of glass                       | `mountGlassText`                          | the page behind the glyphs          |
| Glass shaped like a logo / image / emoji        | `mountGlassShape`                         | the page behind that alpha          |
| Buttons, switches, segmented controls           | `mountGlassButton` / `mountGlassDropdown` | the control's own backdrop          |
| A press ripple that refracts                    | `mountSvgRipple`                          | the button's content                |
| Shapes that merge like droplets                 | `mountGlassGroup`                         | one shared pane under all items     |
| Scannable glass QR                              | `@liquidglassjs/qr`                       | WebGL shader (own package)          |

`mountGlass` picks a render path with `mode: 'auto'`:

- **svg** — the default. `filter: url()` over live DOM. Free at rest (the browser
  caches filter output while content holds still).
- **webgl** — for a `<canvas>` / `<video>` / `<img>` source. Those are volatile, so
  the browser re-filters them _every frame_ even when static; the WebGL path exists
  to avoid that. Lazy-imported, so SVG-only consumers ship none of it.
- **behind** — `behind: sceneEl` names live page content the glass floats over but
  doesn't own (a navbar's sibling `<main>` — a SIBLING, never an ancestor). On
  Firefox the backdrop becomes a LIVE `-moz-element()` image of that element,
  refracted by the normal chain (lazy-imported behind a capability probe, zero
  bytes elsewhere); on Chromium the case falls through to frost, which refracts
  the real page there; on Safari it stays a frosted blur — no backdrop route
  exists in WebKit at all.
- **frost** — a blurred backdrop. Refractive on Chromium, plain `blur()` elsewhere
  (see Pitfalls).

## Install

```sh
pnpm add @liquidglassjs/core          # vanilla / Astro
pnpm add @liquidglassjs/react         # <LiquidGlass>, useGlassLoupe, …
pnpm add @liquidglassjs/element       # <liquid-glass> custom element (Vue/Svelte/Angular/HTML)
pnpm add @liquidglassjs/qr            # glass QR (pulls `qrcode`)
```

```js
import '@liquidglassjs/core/css'; // once, anywhere
```

Every renderer touches `document`/canvas/SVG, so call them **client-side only** —
Astro `<script>` is fine, React needs `useEffect`, never during SSR.

## Quick starts

### A glass panel over page content

```js
import { mountGlass } from '@liquidglassjs/core';

const glass = mountGlass(document.querySelector('.panel'), {
  refract: document.querySelector('.page-content'), // what to bend
  radius: 22,
  strength: 16, // refraction reach in px
  chroma: 0.3, // per-channel split (the rainbow rim)
  dome: 14, // interior swell
});
glass.dispose();
```

### A draggable lens

```js
import { mountGlassLens } from '@liquidglassjs/core';

const lens = mountGlassLens({
  target: card, // the live DOM that bends
  host: document.body, // where the hidden <svg><filter> lives
  lensW: 150,
  lensH: 150,
  radius: 40,
});
lens.setPos(x, y); // cheap — call it per frame
lens.setSize(w, h); // regenerates the map
lens.reconfigure({ strength: 24 });
lens.setActive(false); // solid until re-enabled (glass-on-interaction)
```

`setPos` is the hot path and is designed for per-frame calls. `setSize` and
`reconfigure` rebuild the displacement map — don't put them in a rAF loop.
`lens.setDisplScale(f)` is a per-frame multiplier on the displacement (attribute
writes only); pair it with the exported `createSpring` for a held-pointer boost,
or in React just pass `<GlassLens press={1.25}>` — the boost springs in while
the pointer is down and out on release.

### The loupe (real magnification)

```js
import { mountGlassLoupe } from '@liquidglassjs/core';

const loupe = mountGlassLoupe({
  source: article, // cloned on open, never mutated
  zoom: 2.2,
  trigger: 'longpress', // 'press' | 'longpress' | 'hover' | 'none'
  longPressMs: 400,
  onMove: (s) => console.log(s.caret),
});
```

`feDisplacementMap` can't scale, so the loupe deep-clones the source, CSS-scales the
clone, and mounts a lens on the copy. Keeping it DOM rather than a bitmap is the
point: glyphs rasterize at final size and stay sharp at any zoom. The clone is a
**snapshot** — canvas bitmaps, form values and scroll offsets are copied, `<video>`
frames are not; call `refresh()` if the source changed.

### Merged glass (droplets)

```js
import { mountGlassGroup } from '@liquidglassjs/core';

const group = mountGlassGroup({
  target: scene, // the live DOM that bends — ONE pane under every item
  host: wrap,
  items: [pillA, pillB], // chrome ABOVE the pane; measured, never filtered
  blend: 28, // silhouettes bridge at a gap of about blend / 2
});
group.update(); // after moving an item — rAF-coalesced re-measure + re-encode
```

All items share one smooth-min map, so anything in a group merges with
anything else in it — approach, touch, overlap. Two SEPARATE glass surfaces
cannot merge (a filter can't sample another filter's field; Apple has the same
rule, which is why their merging needs a shared container too). Groups are
bevel-only (a union has no centre to dome from), rounded-rects only for now,
and a merge has no cheap-attribute form — `update()` re-encodes the map, so
call it from the gesture, not from a rAF loop that isn't moving anything.
Because the items sit above the filtered pane rather than inside it, sliding
one with a CSS transform is safe in Safari.

### Glass letterforms and glass shapes

```js
import { mountGlassText, mountGlassShape } from '@liquidglassjs/core';

mountGlassText({ target: h1, host: document.body, strength: 8, bevel: 2.5 });
mountGlassShape({ target: svgMark, host: document.body, source: svgMark });
```

Both rasterize a map shaped like the alpha, then clip back to `SourceAlpha` so the
silhouette stays crisp. `mountGlassText` reads the element's **computed** font, so
any loaded typeface works — await `document.fonts.ready` first.

### Easing a param on hover or press

```js
import { mountGlassText, glassTween } from '@liquidglassjs/core';

const glass = mountGlassText({ target: h1, host: h1, strength: 4 });
const tween = glassTween(glass, { duration: 320 });

h1.addEventListener('pointerenter', () => tween.to({ strength: 12.5 }));
h1.addEventListener('pointerleave', () => tween.to({ strength: 4 }));
```

Retargets from the current value if it's called mid-flight, so hovering in and out
faster than the duration stays continuous. Jumps straight to the target under
`prefers-reduced-motion: reduce`. It tweens the cheap params and applies any others
once, up front — see the pitfall below for which is which, and why a tween that didn't
know the difference would drop frames.

No presets ship with it: `duration` and `easing` are yours (`cubicBezier` is exported
if you want the overshoot the built-in controls use).

## The rim profile — where the bend lives

Every rounded-rect surface (mount, lens, loupe, button, dropdown) takes
`profile: 'erf' | 'circle'`, the falloff of displacement across the `depth` band:

- **`'erf'`** (default) — a soft meniscus. Reaches ~92% at the rim and bleeds
  roughly two band-widths into the interior. Byte-identical to what the library
  has always rendered.
- **`'circle'`** — the quarter-circle bevel iOS 26 ships (verified
  screenshot-for-screenshot on Android's port of Apple's curve): displacement
  peaks at exactly 100% **at the rim** and lands at zero at the band's inner
  edge — the crisp "compression ring".

The physics is the intuition: refraction only happens where the surface is
_sloped_. A flat-topped slab bends nothing in the middle — light enters at
normal incidence — and bends hardest at the bevel's grazing rim, so a real
glass tile concentrates all its optics at the edge and leaves the interior an
undistorted plateau. That is also Apple's legibility trick: with `'circle'`
you can raise `strength` for a louder rim without disturbing text mid-panel,
because none of the bend leaks inward. The cost is at the rim — push far
enough and the vertical-tangent edge folds content back on itself — so keep
`depth` narrow relative to the surface, as Apple does.

`profile` is a **map input**: switching it re-encodes the PNG (see "Animating
the wrong param"), so set it at mount or on a discrete toggle, never per frame.

## Pitfalls

Ordered by how often they bite. The Safari ones are not theoretical: every one cost
real debugging time and is verified against Chromium and Firefox.

### HIGH — CSS-animating or transitioning a child of a glass element (Safari)

Safari gives an element with a **running CSS transform animation** its own
compositing layer, and a composited layer is left **out of an ancestor's SVG
filter**. That child floats above the glass, sharp and unrefracted, while its
siblings bend correctly.

```css
/* ✗ this child will not refract in Safari */
.card__badge {
  animation: bob 4s ease-in-out infinite;
}
```

```js
/* ✓ the same motion from script does refract */
const step = (now) => {
  badge.style.transform = `translateY(${Math.sin(now / 700) * 9}px)`;
  requestAnimationFrame(step);
};
requestAnimationFrame(step);
```

A running transform **transition** promotes it just the same — a pill that slides on
`transition: transform` is the common case, and it leaves the strip it vacated
unrepainted over a filtered sibling. A script-set `transform` is an ordinary style
change and doesn't promote. `will-change: transform` **alone is fine** — it's the
running animation or transition that promotes. Only the animated element is excluded; siblings still refract. Chromium
and Firefox refract either way.

### HIGH — Putting a live `<canvas>` under SVG glass (Safari)

The same rule, triggered a different way. An **actively-redrawn canvas** gets its own
compositing layer in WebKit, so it too drops out of an ancestor's SVG filter: the
canvas rides over the glass dead flat while the DOM beside it bends correctly. Nothing
in the filter is wrong, and the filter chain has no way to detect it.

```js
/* ✗ in Safari the glass has nothing to bend — the canvas is on its own layer */
mountGlassLens({ target: myLiveCanvas, host: document.body, lensW: 150, lensH: 150 });
```

Two ways out, both fine:

- **Render that content as DOM instead.** Spans/divs positioned from script stay in
  the filtered subtree, and they refract in every engine.
- **Pass it as `source` and take the WebGL path.** `mountGlass({ source })` with
  `mode: 'auto'` re-samples the canvas as a texture, where compositing is irrelevant.
  You want this anyway: a canvas or video is volatile, so the SVG path re-runs the
  filter _every frame_ even when nothing moved — the one case where glass is not free
  at rest.

A canvas that is painted once and then left alone is not affected.

### HIGH — Verifying Safari glass from a screenshot

**Safari's capture path is not its compositing path.** A screenshot shows the
composited child _refracted_ even when the live page doesn't. Any conclusion drawn
from a still image can be exactly backwards. Check it on screen.

And "WebKit" is not one renderer. Playwright's has neither the compositing behaviour
above nor Safari's filter-output cache, so it reproduces neither bug and will happily
green-light broken code. The embedded WebKit inside a dev tool or desktop app differs
again, and can show glass bugs Safari does not have — glass that only comes right after
something forces a rebuild is a known example. Confirm in Safari itself before fixing:
a workaround for a behaviour only your harness has costs frame time and buys nothing.
Automated cross-engine checks are fine for geometry, useless for these.

### HIGH — Calling a renderer during SSR

Everything touches `document`, canvas or SVG. Guard it: React `useEffect`, Svelte
`onMount`, Astro client `<script>`. A bare module-scope call breaks the build.

### HIGH — Glass that turns out to be a plain blur

`mountGlass` picks its path in order: an explicit `refract` target, then a `source`
plus WebGL2, then a `backdrop`, and frost only if it was given none of them. Frost
refracts on Chromium and is a plain `blur()` everywhere else — so a surface that looks
flat outside Chrome has usually just not been handed anything to bend. Pass `refract`
(the element behind it) or `backdrop` (the page's own background) and it takes the SVG
path, which works in every browser.

### MEDIUM — Rasterizing text without checking the used size

A canvas 2D context takes `font-style font-weight font-size font-family` and nothing
else. Properties that change the _used_ glyph size without changing the reported
`font-size` — `font-size-adjust` on a root element, most often — leave the raster at
the wrong scale, and the error accumulates along the run. `mountGlassText` measures the
DOM's laid-out run and scales to match; do the same if you build your own alpha map.

### MEDIUM — Blaming the filter for the typeface

Two things look exactly like the glass having clipped a glyph, and neither is the
filter. A weight the family doesn't ship is synthesised by smearing the outline, which
blunts a tapered terminal into a flat stub — a script `q` reads as sliced off. And a
script or display face's descenders routinely reach past `line-height` into the line
below, which reads as an overlap the glass caused. Remove the filter and look at the
glyphs before changing anything in the map.

### MEDIUM — Comparing screenshots of something that animates

Two captures of a particle field, a drifting lens or a bobbing badge are at different
points in the animation, so they always differ and the difference means nothing. Freeze
it — or drive it from a fixed clock — before comparing anything across engines or
across a change.

### MEDIUM — Expecting `mode: 'frost'` to refract off Chromium

Safari and Firefox accept `url(#…)` in the `backdrop-filter` grammar and paint
nothing for it ([WebKit 245510](https://bugs.webkit.org/show_bug.cgi?id=245510)), so
`CSS.supports()` cannot gate it. The frost path checks the engine and falls back to
a plain `blur()`. If you need real refraction everywhere, use the SVG path
(`refract`) rather than frost. For a bar over content it doesn't own, pass
`behind` — that upgrades Firefox to live refraction via `-moz-element()` and
leaves only Safari on the blur; there is no route to real backdrop refraction
in WebKit, so never promise one.

### MEDIUM — A filter target with no bleed

A filter can only bend pixels it was handed. If the target ends exactly at the
visible rim there is nothing outside to pull inward and the edge smears instead of
refracting. The built-in renderers inset their target by a bleed margin and clip the
ring away; do the same if you build a custom target.

### MEDIUM — Animating the wrong param

`reconfigure` splits in two, and the halves are ~180× apart:

- **Free to drive per frame** — `strength`, `chroma`, `blur` (plus `spec` on the morph
  surface and the ripple). These only ever land on a filter attribute. ~0.01ms a call.
- **Not** — `bevel`, `dome`, `depth`, `profile`, `edge`, `glow`, `shade`, `radius`, and `setSize`.
  These are what the displacement map is built from, so each one re-encodes a PNG.
  ~1.8ms a call on a lens, which is a third of a 60fps frame.

So sweeping `strength` makes a nice liquid pulse for the cost of a `setAttribute`,
while sweeping `dome` at the same rate will not hold frame rate. `setPos` is cheap and
designed for per-frame calls; resize on settle.

The library ships no animation presets — curves and timings are yours — but the cheap
set above is safe in a plain `requestAnimationFrame` loop. The built-in motion
(`glassTween`, `createSpring`, the button/dropdown morphs, the ripple) honours
`prefers-reduced-motion` on its own; a hand-rolled rAF loop is yours to gate —
`prefersReducedMotion()` is exported for exactly that.

### MEDIUM — Gradient-filled glass text losing its descenders

`background-clip: text` paints the gradient only inside the background positioning
area — the padding box — so a glyph that reaches past it is never filled. Script `q`
tails, swashes and italic entry strokes stop dead in a straight line, and it reads as
the filter having clipped them. It hasn't; the fill just wasn't painted there.

```css
.glass-heading {
  /* grow the paint area, keep the layout */
  padding: 0.25em 0.25em 0.45em;
  margin: -0.25em -0.25em -0.45em;
}
```

The map itself already covers the ink — `mountGlassText` sizes its margin from the
measured ink box, not from `line-height`.

### MEDIUM — Expecting one `bevel` to suit every face

`bevel` is a rim width in px and a stroke's width is not fixed, so the library scales
it to the artwork — mean stroke width read off the coverage, with the rim held between
1/8 and 1/3 of it. Between those bounds your value is used exactly. That is what lets
`mountGlassText` keep one setting across families, weights and sizes instead of
needing a tweak per face; if you are hand-rolling an alpha map, do the same or a
letterform that is thinner than 3× your bevel will wash out to a ghost.

### MEDIUM — Expecting a small `blur` to do what you asked

No engine applies a real Gaussian; all three approximate one with three integer-width
box blurs, so the only radii available are `sqrt(d² - 1) / 2`. WebKit restricts itself
to odd `d >= 3`, so **Safari cannot blur by less than ~1.4px** — every `stdDeviation`
from 0.1 to 1.8 renders identically there, while Chromium renders nothing below 0.8.

The library snaps `blur` to the rungs all three share so one value renders the same
everywhere. So `blur: 0.4` gives you nothing (deliberately — it was a full blur in
Safari and nothing in Chrome), and `blur: 1` gives you 1.41. Ask for 0 or >= 1.4 and
you get exactly what you asked for.

### LOW — A canvas gradient greying out colour emoji (WebKit)

Painting a gradient into a 2D context makes WebKit render every colour-bitmap glyph
drawn into that context _afterwards_ as a grey silhouette. A flat translucent
`fillRect` is fine — it's specifically a gradient. Bake the gradient into its own
canvas and `drawImage` it in. Unrelated to the filter, but it bites when compositing
an emoji-laden source to refract.

### LOW — A WebGL canvas with square corners (Firefox)

A live canvas is its own compositing layer, and Firefox ships that layer square:
wrapper overflow, `border-radius` on the canvas, and `clip-path` on the canvas are
ALL skipped by the compositor (verified windowed on Firefox 154; headless/software
WebRender renders it correctly, so screenshots from CI will lie). The fix is to
force rasterization with a visually-no-op opaque mask —
`mask-image: linear-gradient(#000 0 0)` — after which the clip-path applies. The
built-in WebGL path does this, Gecko-gated via
`@supports (background-image: -moz-element(#a))`; do the same for any live canvas
YOU place inside rounded glass, because a rounded layer above a square one merely
covers it.

### LOW — Writing your own displacement chain

The library handles all of this; you only meet it if you hand-roll a filter. Each is
invisible until it bites, and the full write-ups with measurements are under
[Building your own filter chain](https://github.com/amir-abushanab/liquid-glass-js/blob/main/docs/GOTCHAS.md):

- **Safari resolves `userSpaceOnUse` against the page**, not the element — region and
  primitive subregions alike. Any transform on the element fixes it; `perspective`
  doesn't. But that transform breaks a `background-attachment: fixed` fill on the same
  element, so there you add the element's document position to the coordinates instead.
- **Safari caches filter output by id.** Mutating a primitive leaves it painting the
  cached result. Rename the filter and re-point the element.
- **On an inline `<svg>`, Safari reads coordinates in viewBox units**, where every other
  engine uses CSS px. Multiply by `viewBoxWidth / cssWidth`.
- **`objectBoundingBox` is the INK bbox**, and the engines disagree about it by a pixel
  or two. Use `userSpaceOnUse` when the size has to be exact.
- **Give `feImage` an explicit subregion**, or it fills whatever filter region the
  engine computed — and they don't compute the same one.

### LOW — Fractional sizing on a lens

A fractional lens size makes the map display at a ~1.0002 scale, and that near-unity
resample beats into a moiré (faint scanlines on a wide lens). The lens rounds to
integer px internally; if you're sizing a custom target, round it.

## Design guidance

- **Refraction is subtle on small controls.** On a switch or slider it's easy to
  miss at rest and it blurs the value underneath. Prefer glass-_on-interaction_:
  solid at rest, glass while pressed or dragged (`setActive(false)` / `true`), which
  is what the built-in controls do.
- **Glass needs something worth bending.** Over a flat background it reads as a grey
  smudge. Put it over type, imagery, a grid — something with structure.
- **`strength` is reach, `chroma` is the rainbow.** Raise `chroma` for a jewelled
  rim; keep it low for a clean optical lens.
- **Honour `prefers-reduced-motion`** for anything that drifts, bobs or ripples —
  the built-ins already do (springs snap, the ripple skips), and the shipped CSS
  answers `prefers-contrast: more` (mostly solid + border) and
  `prefers-reduced-transparency` (frostier) on its own.
- **`'circle'` for chrome, `'erf'` for scenes.** The ring profile keeps mid-panel
  text legible under a loud rim — right for navbars, buttons, cards over content.
  The meniscus distributes the bend — right when the glass itself is the artwork.
- **The light can move.** `specularRotation` (degrees) is live on the lens, loupe
  and group — but it's a map input, so quantize (5–10° steps) before tying it to
  pointer bearing or device tilt, and fold it into a gesture that already
  regenerates (a group drag) so one regen serves both.
- **`supersample` is a niche knob.** `mountGlass({ supersample: 2 })` rasterizes
  the refracted content at 2× on Chromium for crisper displaced text. Its benefit
  is confined to the bent rim band and mostly vanishes on retina displays —
  reach for it only when heavy bend runs through small text on 1× screens.
