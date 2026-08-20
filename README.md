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
varies: on Chromium the frost _refracts_ the live page through the same
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

| Import                                   | Ships                                                                                            | Notes                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `@liquidglassjs/core`                    | `mountGlass` + every SVG-path renderer (`mountGlassLens`, `mountSvgRipple`, `mountGlassText`, …) | **No WebGL, no `qrcode`.** WebGL is lazy-imported at runtime only if a surface hits that path. |
| `@liquidglassjs/core/webgl`              | `GlassGL` (the WebGL renderer)                                                                   | Its own chunk.                                                                                 |
| `@liquidglassjs/qr` _(separate package)_ | `mountGlassQR` + the QR internals                                                                | The only package that depends on `qrcode`; built on `@liquidglassjs/core`.                     |
| `@liquidglassjs/core/css`                | the `.ps-glass*` styles                                                                          | Import once per app.                                                                           |

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

| Var                | Role                                     | Default                |
| ------------------ | ---------------------------------------- | ---------------------- |
| `--glass-paper`    | base "paper" behind the tint + SVG clone | `#fff`                 |
| `--glass-ink`      | rim ink                                  | `#000`                 |
| `--glass-frost-bg` | frosted-fallback background              | 55% of `--glass-paper` |
| `--glass-backdrop` | default backdrop for the SVG-clone path  | consumer-supplied      |

```css
.ps-glass {
  --glass-paper: var(--paper);
  --glass-ink: var(--ink);
}
```

## Gotchas

Things that bite when you put an SVG filter over live DOM. Most aren't specific to this
library — they're how the engines behave.

### Safari

- **Filter coordinates land in the wrong place.** Anything positioned with
  `userSpaceOnUse` — the filter region, an `feImage` subregion — resolves against the
  top-left of the page instead of the element, so the further down the page the element
  sits, the further off the map lands. Any transform on the element fixes it;
  `rotate: 0deg` is enough. `perspective` doesn't, which is the tell that this is about
  owning a coordinate system.
- **That transform breaks `background-attachment: fixed` on the same element.** A
  transformed element becomes the containing block for its own fixed backdrop, which
  squeezes the backdrop into the element box. If the element has one, add the element's
  document position to the filter's coordinates instead of transforming it.
- **Filter output is cached by id.** Change a primitive's attributes and Safari keeps
  painting the result it cached when that id was created, so anything driven through
  the filter per frame freezes at whatever it looked like on the first one. Re-inserting
  the node doesn't help and neither does nudging the element. Rename the filter and
  point the element at the new name.
- **Composited layers are skipped by an ancestor's filter.** The layer floats above the
  glass, sharp, while everything beside it bends. Two things promote an element: a
  running CSS transform animation, and a `<canvas>` redrawn every frame. Animate from
  script instead — setting `el.style.transform` each frame doesn't promote, and
  `will-change` on its own is fine — and either render canvas content as DOM or sample
  the canvas in WebGL.
- **On an inline `<svg>`, filter coordinates are read in viewBox units.** Everywhere
  else they're CSS px, including Safari on an HTML element. A 64-unit viewBox drawn at
  200px makes every number in the filter three times too big. Multiply by
  `viewBoxWidth / cssWidth`.
- **Blurs below about 1.4px don't exist.** See the blur bullet below.
- **A gradient painted into a 2D canvas turns colour emoji grey.** Every emoji drawn
  into that context afterwards comes out a grey silhouette. A flat translucent
  `fillRect` is fine, so it's gradients specifically. Bake the gradient into its own
  canvas and `drawImage` it in.

### Firefox

- **A WebGL canvas keeps square corners inside a rounded box.** Overflow and
  `border-radius` on the wrapper aren't enough: a canvas is its own compositing layer,
  and Firefox clips those to the ancestor's box but not to its rounded corners. Put
  `border-radius: inherit` on the canvas.
- **`repeating-linear-gradient` washes out 1px lines.** A hairline grid built that way
  goes faint or disappears. Use a plain `linear-gradient` and repeat it with
  `background-size`.

### Every browser

- **`feGaussianBlur` isn't a Gaussian.** All three approximate one with three
  integer-width box blurs, so the only radii that exist are `sqrt(d² - 1) / 2` — 1.41,
  2.45, 3.46 and up. Chromium will use any width, Firefox runs a real Gaussian for
  small values, and Safari uses odd widths only and never below 3. That's why a
  `stdDeviation` of 0.4 is invisible in Chrome and a full blur in Safari. Pick a radius
  all three can hit or you get three different pictures. This library snaps `blur` for
  you, so under ~0.7 you get 0 and `blur: 1` renders as 1.41.
- **A rim width in px only looks right at one stroke width.** Bevel a glyph or a mark
  with a fixed blur and it reads as a highlight on a heavy display face and swallows a
  light one whole — once the blur is wider than the stroke there's no flat interior
  left, so every pixel is an edge and the whole shape washes out. Scale the rim to the
  artwork: mean stroke width is `2 × area / total variation` of the coverage, which is
  one pass over the alpha you already rasterized. This library holds it between 1/8 and
  1/3 of that, which is why one `bevel` works across families, weights and sizes.
- **`background-clip: text` cuts glyphs at the element box.** Filling glass
  letterforms with a gradient is the obvious way to make them read as glass, but the
  gradient only paints inside the background positioning area — the padding box — so
  any descender, swash or entry stroke that reaches past it is never filled and stops
  dead in a straight line. It looks exactly like the filter clipped it, and it isn't.
  Pad the element out to the ink and take the same amount off the margin, so the paint
  area grows and the layout doesn't.
- **Only three params are cheap to animate.** `strength`, `chroma` and `blur` land on
  a filter attribute, so driving them per frame costs about a `setAttribute` (~0.01ms).
  Everything else — `bevel`, `dome`, `depth`, `edge`, `glow`, `shade`, `radius`, and
  any resize — is an input to the displacement map, so each change re-encodes a PNG
  (~1.8ms on a lens, a third of a 60fps frame). Sweeping `strength` is a liquid pulse
  for free; sweeping `dome` the same way drops frames. `glassTween(instance).to({…})`
  eases the cheap ones for you and applies the rest in one go, so it can't be held
  wrong.
- **The filter bends pixels, it can't scale them.** There's no magnification in
  `feDisplacementMap`. To magnify, scale a copy of the content and put the filter over
  the copy.
- **A filter can only bend what you hand it.** If the target ends exactly at the visible
  rim there's nothing outside to pull inward, so the edge smears instead of refracting.
  Inset the target by a bleed margin and clip the extra ring away.
- **`backdrop-filter: url(#…)` parses everywhere and paints only in Chromium.** Safari
  and Firefox accept it and then draw nothing
  ([WebKit 245510](https://bugs.webkit.org/show_bug.cgi?id=245510)), so `CSS.supports()`
  can't tell you. You have to check the engine.
- **A `<canvas>` or `<video>` behind glass re-filters every frame**, even when nothing
  moved. Over static DOM the browser caches filter output and the glass is free at rest;
  a volatile source throws that away.
- **A filter region in `objectBoundingBox` units isn't the border box.** It's the ink
  bounding box, and the engines disagree about it by a pixel or two. If the size has to
  be exact, use `userSpaceOnUse`.
- **Give `feImage` an explicit subregion.** Without one it fills the filter region, so
  the map's size and position depend on whatever region the engine computed — and they
  don't compute the same one.
- **Round your dimensions.** A fractional size makes the map resample at about 1.0002,
  and that near-unity scale beats into faint moiré scanlines.
- **It's all browser-only.** Filters, canvas and `document` don't exist during SSR. Call
  from `useEffect`, `onMount` or a client `<script>`, never at module scope.

### Testing this

- **Don't trust a Safari screenshot.** Its capture path isn't its compositing path, so a
  screenshot shows a composited child refracted even when the live page doesn't. A
  conclusion drawn from a still image can be exactly backwards.
- **Playwright's WebKit is a third browser.** It has neither the filter cache nor the
  compositing behaviour, so it reproduces neither and will happily pass code that's
  broken in Safari. Fine for geometry, useless for these.
- **Don't compare screenshots of anything animating.** Two captures from different
  engines are at different points in the animation, so they always differ and it tells
  you nothing. Freeze it first.

## Credits

The filter-on-content idea comes from Aave's
[_Building Glass for the Web_](https://aave.com/design/building-glass-for-the-web),
which covers the optics in depth. A few constants here (the
`erf ≈ tanh(√π·x)` approximation, the spherical-cap dome profile, the R/G/B
displacement-map layout, the fresh-filter-id Safari workaround) trace back to
that write-up.

## License

[MIT](./LICENSE) © Amir Abushanab.
