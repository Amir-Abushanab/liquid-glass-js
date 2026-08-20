---
name: liquid-glass
description: >
  Add Apple-style liquid glass — real refraction, not a blur — to a website via the
  @liquidglassjs packages: @liquidglassjs/core (mountGlass, mountGlassLens,
  mountGlassText, mountGlassShape, mountGlassLoupe, mountGlassButton/Dropdown,
  mountSvgRipple), @liquidglassjs/react, @liquidglassjs/element (<liquid-glass>) or
  @liquidglassjs/qr. Load this when a user wants a glass card/panel/navbar, a
  draggable magnifying lens or iOS press-and-hold text loupe, glass letterforms, glass
  shaped like a logo or image, glass buttons/switches/dropdowns with a ripple, a glass
  QR code, or asks why their glass looks flat, blank or unrefracted in Safari.
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
| A lens that moves across a surface              | `mountGlass` → `mountGlassLens`           | whatever it's parked over           |
| iOS press-and-hold text magnifier               | `mountGlassLoupe`                         | a scaled clone (real magnification) |
| Letterforms made of glass                       | `mountGlassText`                          | the page behind the glyphs          |
| Glass shaped like a logo / image / emoji        | `mountGlassShape`                         | the page behind that alpha          |
| Buttons, switches, segmented controls           | `mountGlassButton` / `mountGlassDropdown` | the control's own backdrop          |
| A press ripple that refracts                    | `mountSvgRipple`                          | the button's content                |
| Scannable glass QR                              | `@liquidglassjs/qr`                       | WebGL shader (own package)          |

`mountGlass` picks a render path with `mode: 'auto'`:

- **svg** — the default. `filter: url()` over live DOM. Free at rest (the browser
  caches filter output while content holds still).
- **webgl** — for a `<canvas>` / `<video>` / `<img>` source. Those are volatile, so
  the browser re-filters them _every frame_ even when static; the WebGL path exists
  to avoid that. Lazy-imported, so SVG-only consumers ship none of it.
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

### Glass letterforms and glass shapes

```js
import { mountGlassText, mountGlassShape } from '@liquidglassjs/core';

mountGlassText({ target: h1, host: document.body, strength: 8, bevel: 2.5 });
mountGlassShape({ target: svgMark, host: document.body, source: svgMark });
```

Both rasterize a map shaped like the alpha, then clip back to `SourceAlpha` so the
silhouette stays crisp. `mountGlassText` reads the element's **computed** font, so
any loaded typeface works — await `document.fonts.ready` first.

## Pitfalls

Ordered by how often they bite. The Safari ones are not theoretical: every one cost
real debugging time and is verified against Chromium and Firefox.

### HIGH — CSS-animating a child of a glass element (Safari)

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

A script-set `transform` is an ordinary style change and doesn't promote the
element. `will-change: transform` **alone is fine** — the running animation is what
promotes. Only the animated element is excluded; siblings still refract. Chromium
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

Playwright's WebKit is a **third** renderer again: it has neither the compositing
behaviour above nor Safari's filter-output cache, so it reproduces neither bug and
will happily green-light broken code. Automated cross-engine checks are fine for
geometry, useless for these.

### HIGH — Calling a renderer during SSR

Everything touches `document`, canvas or SVG. Guard it: React `useEffect`, Svelte
`onMount`, Astro client `<script>`. A bare module-scope call breaks the build.

### MEDIUM — Expecting `mode: 'frost'` to refract off Chromium

Safari and Firefox accept `url(#…)` in the `backdrop-filter` grammar and paint
nothing for it ([WebKit 245510](https://bugs.webkit.org/show_bug.cgi?id=245510)), so
`CSS.supports()` cannot gate it. The frost path checks the engine and falls back to
a plain `blur()`. If you need real refraction everywhere, use the SVG path
(`refract`) rather than frost.

### MEDIUM — A filter target with no bleed

A filter can only bend pixels it was handed. If the target ends exactly at the
visible rim there is nothing outside to pull inward and the edge smears instead of
refracting. The built-in renderers inset their target by a bleed margin and clip the
ring away; do the same if you build a custom target.

### MEDIUM — Rebuilding the map in an animation loop

`setPos` is cheap; `setSize` and `reconfigure` regenerate the displacement map (and
mint a fresh filter id). Calling those per frame will tank the frame rate. Move
position per frame, resize on settle.

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
- **Honour `prefers-reduced-motion`** for anything that drifts, bobs or ripples.
