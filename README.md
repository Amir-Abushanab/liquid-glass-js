# @liquidglassjs/core

SVG-first **liquid glass** for the web. The primary renderer is an SVG
`feDisplacementMap` applied to **live DOM**, so it works in every modern
browser (Chrome, Safari, Firefox) with no flags. The content under the glass
stays selectable, scrollable, and clickable. WebGL and a procedural QR are
optional, code-split escape hatches for the two cases an SVG filter can't
cover.

<p align="center">
  <a href="https://amir-abushanab.github.io/liquid-glass-js/">
    <img src="docs/media/lens.webp" alt="The glass lens drifting across live DOM text and colour chips, merging with the resting blob as it passes" width="592">
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
3. **`behind` (live page content, e.g. a navbar's sibling `<main>`)** → on
   Firefox, the surface's background becomes `-moz-element()` of that element —
   a **live** image, no clone, no snapshot — refracted by the usual filter
   (lazily imported, so no one else downloads it). Chromium serves the same
   case through path 4's `backdrop-filter: url()`; WebKit stays frosted.
4. **`backdrop` (CSS background)** → SVG filter on a viewport-locked clone.
5. **otherwise** → frosted `backdrop-filter` (last resort).

<p align="center">
  <a href="https://amir-abushanab.github.io/liquid-glass-js/">
    <picture>
      <source media="(prefers-color-scheme: light)" srcset="docs/media/render-paths-light.webp">
      <img src="docs/media/render-paths-dark.webp" alt="The three render paths side by side: an SVG filter over live selectable DOM, WebGL for a canvas or video, and the frost fallback" width="800">
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
    <img src="docs/media/dropdown.webp" alt="The glass dropdown materializing open over the gradient scene, refraction ramping in as the items stagger" width="800">
  </a>
</p>

The menu's `.gm-dd__bg` pane is the layer the filter bends. Point its
`background` at a fixed-attachment clone of the scene behind the menu and the
panel refracts the real page. The `/css` import ships the structure and the
label crossfade; sizing, colour, and the scene are yours. Both return
`dispose()`. `createGlassSurface` is exported too, for the raw resizable /
fade-able filter.

### Merging glass

`mountGlassGroup` gives several elements ONE displacement map whose rounded
rects fuse by smooth-min — Apple's droplet merge. The elements are chrome above
a shared refract pane; bring one within about `blend / 2` px of another and
their rims flow together through a neck. (The CSS "gooey" trick merges only the
alpha silhouette; here the refraction fields themselves fuse.)

```ts
import { mountGlassGroup } from '@liquidglassjs/core';

const group = mountGlassGroup({
  target: scene, // the live DOM that bends
  host: wrap,
  items: [pillA, pillB], // chrome above the scene — measured, never filtered
  blend: 28,
});
// after moving an item (transform, layout, drag):
group.update(); // rAF-coalesced re-measure + map re-encode
```

A merge has no cheap-attribute form — the neck's shape changes — so `update()`
re-encodes the map. It computes only the shapes' bounding box plus a fuse
apron, so control-sized drags stay in the low milliseconds. Because the items
sit above the filtered pane rather than inside it, sliding one with a
transform is safe in Safari (the composited-child rule never triggers).

## Glass from any shape

`mountGlassText` turns letterforms into glass; `mountGlassShape` does the same
for any alpha coverage: an inline SVG mark, an `<img>`, a `<canvas>`, or a raw
`draw` callback. The displacement map is shaped like the source's opaque pixels
and the filter clips to the target's `SourceAlpha`, so the glass traces the
artwork's silhouette.

<p align="center">
  <a href="https://amir-abushanab.github.io/liquid-glass-js/">
    <img src="docs/media/typeface.webp" alt="Glass typeface: letterforms rasterized into a displacement map, refracting an animated gradient" width="800">
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
    <img src="docs/media/anything.webp" alt="Glass from any alpha source: a droplet, a sparkle, an emoji orb, a meme card, and framework logos as glass" width="800">
  </a>
</p>

Both the shape and text (and the moving lens) take two material options:
`shade` (0 to 1, a dark occlusion rim opposite the glint that reads as real-glass
depth) and `glint` (a CSS colour to tint the specular highlight). They default
to off and white respectively, so existing surfaces stay pixel-identical until
you opt in.

The rounded-rect surfaces (mount, lens, loupe, button, dropdown) also take
`profile: 'erf' | 'circle'` — the rim's falloff curve — and the lens, loupe and
group take a live `specularRotation` (light angle in degrees; a map input, so
quantize it if you tie it to the pointer or device tilt). `'erf'` (default) is the
soft meniscus this library has always rendered; `'circle'` peaks exactly at the
rim for the crisp iOS-style compression ring. Same defaults-off rule: `'erf'`
is byte-identical to before. The React `<GlassLens>` additionally takes
`press` (a displacement multiplier that springs in while the pointer is held,
default 1 = off).

`mountGlass` takes one more: `supersample` (default 1 = off). On the live-DOM
refract path it lays the content out at its natural size, scales it up G×
into the filtered layer, and scales the filtered result back down — the whole
chain runs on a G× raster, so displaced small text keeps its subpixel
antialiasing instead of going soft. Chromium only (elsewhere the filter runs
in software and G² pixels just quadruple a slow path — the option is silently
1× there), and it needs the standard `__refract`/`__refract-inner` pair.
Costs G² raster memory; clamp is 3.

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

Things that bite when you put an SVG filter over live DOM — Safari's page-origin
filter coordinates and its id-keyed filter cache, composited children escaping
filters and clips, the box-quantised blur every engine shares, what
`backdrop-filter: url()` really renders where, and how to test any of it without
being lied to. The list outgrew this file: it lives in
**[docs/GOTCHAS.md](./docs/GOTCHAS.md)**, grouped by what you're doing (using the
library · styling around the glass · building your own filter chain · testing),
with the measurements behind every claim.


## Credits

The filter-on-content idea comes from Aave's
[_Building Glass for the Web_](https://aave.com/design/building-glass-for-the-web),
which covers the optics in depth. A few constants here (the
`erf ≈ tanh(√π·x)` approximation, the spherical-cap dome profile, the R/G/B
displacement-map layout, the fresh-filter-id Safari workaround) trace back to
that write-up.

Some later refinements were borrowed from the wider liquid-glass field, with
thanks:

- **`profile: 'circle'`** — the quarter-circle bevel whose displacement peaks
  exactly at the rim (the crisp iOS compression ring) is the curve
  [Kyant0's AndroidLiquidGlass](https://github.com/Kyant0/AndroidLiquidGlass)
  screenshot-verified against iOS 26;
  [kube.io's ray-traced maps](https://kube.io/blog/liquid-glass-css-svg/) reach
  the same rim-max shape from Snell's law.
- **The `press` boost** — a spring driving the `feDisplacementMap` scale while
  the pointer holds the glass — is
  [ZeroxyDev's](https://github.com/ZeroxyDev/liquid-glass-js) `refractionBoost`
  idea. The spring's timestep clamp is a lesson from
  [clayharmon's webgl-liquid-glass](https://github.com/clayharmon/webgl-liquid-glass):
  integrate one dropped-to-15fps frame whole and a stiff spring overshoots
  further than it started, compounding to NaN.
- **The legibility tiers** follow Apple's own semantics from
  [WWDC25's _Meet Liquid Glass_](https://developer.apple.com/videos/play/wwdc2025/219/)
  — reduced transparency goes frostier, increased contrast goes mostly solid
  with a contrasting border, reduced motion "disables any elastic properties" —
  keyed off `prefers-contrast` as well because Safari has never shipped
  `prefers-reduced-transparency`.
- **The moving light** — driving the specular from the pointer's bearing and
  from DeviceOrientation is
  [clayharmon's webgl-liquid-glass](https://github.com/clayharmon/webgl-liquid-glass)
  idea (the one web glass whose rim light answers the world, as Apple's does);
  ours arrives as a live `specularRotation` param, quantized because the light
  is baked into the map.
- **The segmented highlighted copy** — the pill refracting a bright copy of
  the track, clipped to itself, so the selected label reads through the glass:
  Aave's [_Building Glass for the Web_](https://aave.com/design/building-glass-for-the-web)
  again.
- **The displacement-map cache** — identical option tuples sharing one PNG is
  how [Glacé](https://seangeng.com/writing/building-a-liquid-glass-ui-kit)
  (Sean Geng's glaceui) manages its maps.

## License

[MIT](./LICENSE) © Amir Abushanab.
