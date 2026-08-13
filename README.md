# @liquidglassjs/core

SVG-first **liquid glass** for the web. The primary renderer is an SVG
`feDisplacementMap` applied to **live DOM**, so it works in every modern
browser (Chrome, Safari, Firefox) with no flags. The content under the glass
stays selectable, scrollable, and clickable. WebGL and a procedural QR are
optional, code-split escape hatches for the two cases an SVG filter can't
cover.

<p align="center">
  <a href="https://amir-abushanab.github.io/liquid-glass-js/">
    <img src="docs/media/lens.png" alt="A draggable glass lens refracting live DOM text, grid lines, and colour chips" width="592">
  </a>
</p>

<p align="center"><a href="https://amir-abushanab.github.io/liquid-glass-js/">Live showcase →</a></p>

## Why SVG-first

The popular web-glass demos use `backdrop-filter: url()`, which is
Chromium-only. This library applies the filter **on the content** instead
(`filter: url()` over the real DOM), which also works in Safari and Firefox.
WebGL is reserved for content an SVG filter can't bend: a `<canvas>` with no
live DOM, or a `<video>` (WebKit refuses to filter video).

## Install

```sh
pnpm add @liquidglassjs/core
```

`qrcode` (the only runtime dependency) is pulled in **only** by the `/qr` entry.

## Usage (vanilla)

```ts
import { mountGlass } from '@liquidglassjs/core';
import '@liquidglassjs/core/css'; // ship the .ps-glass* chrome once

const el = document.querySelector('.card');
const glass = mountGlass(el, { refract: el.querySelector('.card__content') });
// ...later
glass.dispose();
```

`mountGlass(root, opts)` builds its own chrome layers and auto-selects the
renderer (`mode: 'auto'`):

1. **`refract` element present** → SVG filter on the live DOM (the primary path; takes precedence).
2. **`source` (canvas/video/img) + WebGL2** → WebGL (lazily imported).
3. **`backdrop` (CSS background)** → SVG filter on a viewport-locked clone.
4. **otherwise** → frosted `backdrop-filter` (last resort).

<p align="center">
  <a href="https://amir-abushanab.github.io/liquid-glass-js/">
    <picture>
      <source media="(prefers-color-scheme: light)" srcset="docs/media/render-paths-light.png">
      <img src="docs/media/render-paths-dark.png" alt="The three render paths side by side: an SVG filter over live selectable DOM, WebGL for a canvas or video, and the frost fallback" width="800">
    </picture>
  </a>
</p>

`mode` can force `'svg' | 'webgl' | 'frost'`. WebGL degrades to frost if WebGL2
is unavailable or the renderer throws.

Paths 1–3 (`filter: url()`) render in every engine. Path 4 is the one that
varies: on Chromium the frost *refracts* the live page through the same
displacement map, while Safari and Firefox get a plain `blur()` — they parse
`backdrop-filter: url()` but paint nothing for it ([WebKit 245510][wk245510]).

[wk245510]: https://bugs.webkit.org/show_bug.cgi?id=245510

## Morphing surfaces

Two surfaces animate their own shape. Both reuse **one** displacement map and
touch only cheap filter attributes per frame (the `<feImage>` box and the
displacement scale). The map itself regenerates only once the size settles,
under a fresh id so Safari doesn't serve a cached one. `displScale: 0` is
clear glass, and ramping it up materializes the refraction.

A button that reshapes when its label changes:

```ts
import { mountGlassButton } from '@liquidglassjs/core';
import '@liquidglassjs/core/css';

const btn = mountGlassButton(document.querySelector('.connect'), { strength: 18 });
btn.setContent('Connecting…'); // morphs the width to fit + crossfades the label
btn.setContent('0x1A2b…9F3c'); // rapid calls interrupt and chase the newest target
```

A dropdown that materializes open (dismisses on outside-click and `Escape`):

```ts
import { mountGlassDropdown } from '@liquidglassjs/core';

const dd = mountGlassDropdown({
  trigger: root.querySelector('.trigger'),
  menu: root.querySelector('.menu'), // needs a `.gm-dd__bg` pane + `.gm-dd__item` children
});
// dd.open() / dd.close() / dd.toggle() / dd.isOpen()
```

<p align="center">
  <a href="https://amir-abushanab.github.io/liquid-glass-js/">
    <img src="docs/media/dropdown.png" alt="A glass dropdown menu refracting the vivid gradient scene behind it" width="800">
  </a>
</p>

The menu's `.gm-dd__bg` pane is the layer the filter bends. Point its
`background` at a fixed-attachment clone of the scene behind the menu and the
panel refracts the real page. The `/css` import ships the structure and the
label crossfade; sizing, colour, and the scene are yours. Both return
`dispose()`. `createGlassSurface` is exported too, for the raw resizable /
fade-able filter.

## Glass from any shape

`mountGlassText` turns letterforms into glass; `mountGlassShape` does the same
for any alpha coverage: an inline SVG mark, an `<img>`, a `<canvas>`, or a raw
`draw` callback. The displacement map is shaped like the source's opaque pixels
and the filter clips to the target's `SourceAlpha`, so the glass traces the
artwork's silhouette.

<p align="center">
  <a href="https://amir-abushanab.github.io/liquid-glass-js/">
    <img src="docs/media/typeface.png" alt="Glass typeface: letterforms rasterized into a displacement map, refracting an animated gradient" width="800">
  </a>
</p>

```ts
import { mountGlassShape } from '@liquidglassjs/core';

const mark = document.querySelector('svg.logo');
const glass = mountGlassShape({ target: mark, host: mark.parentElement, source: mark });
// source can also be an HTMLImageElement / HTMLCanvasElement / url, or pass
// draw(ctx, w, h) to paint the coverage yourself. Cross-origin images need CORS.
```

<p align="center">
  <a href="https://amir-abushanab.github.io/liquid-glass-js/">
    <img src="docs/media/anything.png" alt="Glass from any alpha source: a droplet, a sparkle, an emoji orb, a meme card, and framework logos as glass" width="800">
  </a>
</p>

Both the shape and text (and the moving lens) take two material options:
`shade` (0 to 1, a dark occlusion rim opposite the glint that reads as real-glass
depth) and `glint` (a CSS colour to tint the specular highlight). They default
to off and white respectively, so existing surfaces stay pixel-identical until
you opt in.

## The loupe

`mountGlassLoupe` recreates the iOS text magnifier: press and hold on a
paragraph and a glass capsule floats above the pointer showing the line under it,
blown up and refracting at the rim.

```ts
import { mountGlassLoupe } from '@liquidglassjs/core';

const loupe = mountGlassLoupe({
  source: document.querySelector('article'),
  zoom: 1.55,
  trigger: 'longpress', // | 'press' | 'hover' | 'none'
  onMove: ({ caret }) => caret && console.log(caret.node.nodeValue, caret.offset),
});
```

The interesting constraint is that a displacement map **bends** pixels and can
never scale them, so the magnification can't come from the filter. Instead the
loupe deep-clones the source, scales the clone with a CSS transform, and mounts
the lens on that copy. Because the magnified content is still DOM, the glyphs
rasterize at their final size and stay pin-sharp — a bitmap snapshot would go
soft at exactly the moment the user asked for detail. The capsule renders in the
top layer (`popover`), so no ancestor's `overflow: hidden` can clip it, and the
filter target is inset by a bleed ring so the rim has real pixels to refract
instead of smearing its own edge.

`trigger` covers the usual gestures; `'none'` binds nothing and hands you
`show(x, y)` / `move(x, y)` / `hide()`. `snapToLine` (default on) pins the sample
to the text line's centre and reports the caret under the pointer, so a selection
UI can ride along. The clone is a snapshot — `refresh()` re-reads a source that
changed. Everything else tunes live through `reconfigure()`, `longPressMs`
included.

A long-press loupe has to suppress the platform's own selection UI, or iOS Safari
answers the same gesture with its native loupe on top of yours. Only the
touch-only properties sit on the element for the whole mount; `user-select` is
taken for the duration of the gesture and handed back on release, so
**press-and-drag still selects text normally** and only a still hold becomes a
loupe — the same split iOS makes.

React (`<GlassLoupe>` / `useGlassLoupe`) and the `<glass-loupe>` custom element
wrap the same mount.

## Entry points (the code-split)

| Import | Ships | Notes |
|---|---|---|
| `@liquidglassjs/core` | `mountGlass` + every SVG-path renderer (`mountGlassLens`, `mountSvgRipple`, `mountGlassText`, …) | **No WebGL, no `qrcode`.** WebGL is lazy-imported at runtime only if a surface hits that path. |
| `@liquidglassjs/core/webgl` | `GlassGL` (the WebGL renderer) | Its own chunk. |
| `@liquidglassjs/qr` *(separate package)* | `mountGlassQR` + the QR internals | The only package that depends on `qrcode`; built on `@liquidglassjs/core`. |
| `@liquidglassjs/core/css` | the `.ps-glass*` styles | Import once per app. |

The split relies on the **consumer's** bundler (Vite / webpack / Rollup split by
default; esbuild needs `--splitting`). The `webgl` subpath is belt-and-suspenders
on top of the internal dynamic `import()`: a consumer who only imports `.` never
references WebGL. The Glass QR is isolated one level further, in its own package
(`@liquidglassjs/qr`), so `qrcode` never enters a core consumer's dependency tree.

## Astro

```astro
---
import LiquidGlass from '@liquidglassjs/core/astro/LiquidGlass.astro';
import LiquidGlassFont from '@liquidglassjs/core/astro/LiquidGlassFont.astro';
---
<LiquidGlass radius={20} strength={16}>
  <slot name="refract"><!-- live DOM to bend --></slot>
  <!-- default slot: overlay content -->
</LiquidGlass>
```

## Theming

The CSS is de-themed: it reads namespaced vars with sane fallbacks and assumes
nothing app-specific. Override per surface or globally:

| Var | Role | Default |
|---|---|---|
| `--glass-paper` | base "paper" behind the tint + SVG clone | `#fff` |
| `--glass-ink` | rim ink | `#000` |
| `--glass-frost-bg` | frosted-fallback background | 55% of `--glass-paper` |
| `--glass-backdrop` | default backdrop for the SVG-clone path | consumer-supplied |

```css
.ps-glass { --glass-paper: var(--paper); --glass-ink: var(--ink); }
```

## Gotchas

Hard-won, all measured. Most of these are things the library can't paper over,
because they're properties of the page you build around the glass.

### Don't CSS-animate anything inside the glass (Safari)

Safari gives an element with a running CSS transform animation its own compositing
layer, and a composited layer is left **out of an ancestor's SVG filter**. A child
that bobs, spins or pulses via `@keyframes` inside a glass element floats above the
glass, sharp and unrefracted, while its siblings bend correctly.

```css
/* this child will NOT refract in Safari */
.card__badge { animation: bob 4s ease-in-out infinite; }
```

```js
/* the same motion, set from script, DOES refract */
const step = (now) => {
  badge.style.transform = `translateY(${Math.sin(now / 700) * 9}px)`;
  requestAnimationFrame(step);
};
requestAnimationFrame(step);
```

A script-set `transform` is an ordinary style change and doesn't promote the
element, so it stays inside the filter. `will-change: transform` **alone is fine** —
the running animation is what promotes. Only the animated element is excluded; its
siblings still refract. Chromium and Firefox refract either way.

### Safari screenshots don't show what Safari renders

Safari's capture path is not its compositing path. A screenshot renders the
composited child *refracted* even when the live page doesn't. **Never verify glass
in Safari from a still image** — check it on screen. (Playwright's WebKit is a
third renderer again: it has neither the compositing behaviour above nor Safari's
filter cache, so it can't reproduce either.)

### The filter can bend pixels, never scale them

`feDisplacementMap` displaces; there is no magnification in the primitive. That's
why [the loupe](#the-loupe) clones the source and scales the *clone* with a CSS
transform, then mounts the lens on that copy — and why the magnified content stays
DOM rather than a rasterized snapshot, so glyphs stay sharp at any zoom.

### Glass needs something outside itself to bend

A filter can only bend pixels it was handed. If the filter target ends exactly at
the visible rim there is nothing beyond it to pull inward, and the edge smears
instead of refracting. Every renderer here insets its target by a bleed margin and
clips the extra ring away — if you build your own target, do the same.

### A canvas or video source is re-filtered every frame

The browser caches filter output while the content behind it holds still, so glass
over static DOM is essentially free and only costs a pass when that content
changes. A `<canvas>` or `<video>` source is treated as volatile and re-filtered
every frame even when nothing moved — which is exactly the case
[`@liquidglassjs/core/webgl`](#entry-points-the-code-split) exists for.

### `backdrop-filter: url(#…)` parses everywhere and paints only in Chromium

Safari and Firefox accept an SVG filter reference in the `backdrop-filter` grammar
and then paint nothing for it, so `CSS.supports()` can't gate on it
([WebKit 245510](https://bugs.webkit.org/show_bug.cgi?id=245510)). `mountGlass`'s
frost path checks the engine instead and falls back to a plain `blur()`. This
affects only frost — `filter: url()` over live DOM works in all three engines.

### A canvas gradient turns colour emoji grey (WebKit)

Painting a gradient into a 2D context makes WebKit render every colour-bitmap glyph
drawn into that context *afterwards* as a grey silhouette. A flat translucent
`fillRect` is fine; it's specifically a gradient. Bake the gradient into its own
canvas and `drawImage` it in — nothing to do with the glass filter, but it bites
when you're compositing an emoji-laden source to refract.

### Browser-only

Every renderer touches `document` / canvas / WebGL / SVG filters. Guard adapters so
they run client-side only (Astro `<script>` is fine; React needs `useEffect`; never
call these during SSR).

## Credits

The filter-on-content idea comes from Aave's
[_Building Glass for the Web_](https://aave.com/design/building-glass-for-the-web),
which covers the optics in depth. A few constants here (the
`erf ≈ tanh(√π·x)` approximation, the spherical-cap dome profile, the R/G/B
displacement-map layout, the fresh-filter-id Safari workaround) trace back to
that write-up.

## License

[MIT](./LICENSE) © Amir Abushanab.
