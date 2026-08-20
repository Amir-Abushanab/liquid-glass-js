# @liquidglassjs/core

SVG-first **liquid glass** for the web. The primary renderer is an SVG
`feDisplacementMap` applied to **live DOM**, so the glass runs in every modern
browser (Chrome, Safari, Firefox) with no flags, while the content underneath
stays selectable, scrollable, and clickable. WebGL and a procedural QR are
optional, code-split escape hatches for the two cases an SVG filter can't cover.

<p align="center">
  <a href="https://amir-abushanab.github.io/liquid-glass-js/">
    <img src="https://raw.githubusercontent.com/Amir-Abushanab/liquid-glass-js/main/docs/media/hero-dark.png" alt="The Liquid Glass showcase: a glass nav bar and a refractive glass typeface over an aurora background" width="830">
  </a>
</p>

## Install

```sh
pnpm add @liquidglassjs/core
```

## Usage

```ts
import { mountGlass } from '@liquidglassjs/core';
import '@liquidglassjs/core/css'; // ship the .ps-glass* chrome once, app-wide

const card = document.querySelector('.card');
const glass = mountGlass(card, { refract: card.querySelector('.card__content') });
// …later
glass.dispose();
```

`mountGlass(root, opts)` builds its own chrome layers and auto-selects the
renderer: an SVG filter over live DOM (the primary path) → WebGL for a
`<canvas>`/`<video>` source → a frosted `backdrop-filter` fallback. Force it with
`mode: 'svg' | 'webgl' | 'frost'`.

Also exported: `mountGlassText`, `mountGlassShape`, `mountGlassButton`,
`mountGlassDropdown`, `mountGlassLens`, `mountGlassLoupe`, `mountSvgRipple`.

## The loupe

`mountGlassLoupe` is the iOS "hold on a word" magnifier: press and hold, and a
glass capsule floats above the pointer showing the line under it, blown up.

```ts
import { mountGlassLoupe } from '@liquidglassjs/core';

const loupe = mountGlassLoupe({
  source: document.querySelector('article'), // what to magnify
  zoom: 1.55,
  trigger: 'longpress', // | 'press' | 'hover' | 'none'
  onMove: ({ caret }) => caret && console.log(caret.node.nodeValue, caret.offset),
});
```

A displacement map bends pixels but can't scale them, so the loupe deep-clones
the source, scales the clone with a CSS transform, and puts the lens filter on
top of that copy — the magnified text is real DOM, so it stays crisp at any zoom
and the rim refracts it like any other glass surface. The capsule renders in the
top layer (`popover`), so no ancestor's `overflow: hidden` can clip it.

`trigger` covers the common gestures; **`'none'` binds nothing** and hands you
`show(x, y)` / `move(x, y)` / `hide()` to drive from your own gesture code. Live
knobs go through `reconfigure()` — `zoom`, `width`, `height`, `offsetY`,
`longPressMs`, and every lens param. Only the ones that change the displacement map
cost a rebuild; `zoom`, `offsetY` and `longPressMs` are free.

Worth knowing:

- The clone is a **snapshot** taken when the loupe opens. Call `refresh()` if the
  source changes underneath it. Canvas bitmaps, form values, and scroll offsets are
  copied across; `<video>` frames are not.
- `snapToLine` (default on) pins the sample to the text line's centre and reports
  the caret, so a selection UI can ride along.
- With `trigger: 'longpress'` the source's native selection UI is suppressed, or iOS
  Safari answers the same gesture with its own loupe on top of yours. Only the
  touch-only bits (`-webkit-touch-callout`, `touch-action`) sit on the element for
  the whole mount — `user-select` is taken for the duration of the gesture and given
  back on release, so **press-and-drag still selects text normally** and only a
  still hold becomes a loupe. `touch-action: none` does stop the source scrolling
  under touch; pass `suppressNative: false` and run your own gesture if you need both.
- The loupe mounts next to the source so the clone keeps the same CSS ancestors.
  Its ids are duplicated for the life of the gesture (the clone is `inert` and
  `aria-hidden`, and stays after the original in document order).

## Entry points

| Import                        | Ships                                                              |
| ----------------------------- | ------------------------------------------------------------------ |
| `@liquidglassjs/core`         | `mountGlass` + every SVG-path renderer. **No WebGL, no `qrcode`.** |
| `@liquidglassjs/core/webgl`   | `GlassGL`, the WebGL renderer (its own chunk).                     |
| `@liquidglassjs/core/css`     | the `.ps-glass*` styles (import once).                             |
| `@liquidglassjs/core/astro/*` | `<LiquidGlass>` / `<LiquidGlassFont>` Astro components.            |

WebGL is lazy-imported only when a surface actually needs it; the QR lives in a
separate package (`@liquidglassjs/qr`) so `qrcode` never enters a core
consumer's dependency tree.

## Framework wrappers

- **React**: [`@liquidglassjs/react`](https://www.npmjs.com/package/@liquidglassjs/react)
- **Vue / Svelte / Angular / plain HTML**: [`@liquidglassjs/element`](https://www.npmjs.com/package/@liquidglassjs/element) (the `<liquid-glass>` custom element)
- **QR codes**: [`@liquidglassjs/qr`](https://www.npmjs.com/package/@liquidglassjs/qr)

Every renderer touches `document` / canvas / WebGL / SVG filters, so call them
client-side only (never during SSR).

## Gotchas

The short list. The [full README](https://github.com/amir-abushanab/liquid-glass-js#gotchas)
has the measurements behind each, plus the Firefox and testing ones.

- **Safari skips composited layers inside the glass.** A child with a running CSS
  transform animation, or a `<canvas>` you redraw every frame, gets its own layer and
  drops out of the ancestor's filter — it floats above the glass, sharp, while
  everything beside it bends. Drive animation from script instead (`el.style.transform`
  per frame doesn't promote; `will-change` alone is fine), and render canvas content as
  DOM or pass it as `source` to take the WebGL path. A canvas painted once is fine.
- **Safari resolves `userSpaceOnUse` filter coordinates against the page**, not the
  element, unless the element has a transform. It also caches filter output by id, so
  changing a primitive does nothing until you rename the filter. And on an inline
  `<svg>` it reads every coordinate in viewBox units. The library handles all three;
  you'll need to if you roll your own chain.
- **`blur` is quantised.** No engine applies a real Gaussian — all three approximate
  one with integer-width box blurs, and Safari can't go below ~1.4px. `blur` is snapped
  to the radii all three can hit, so anything under ~0.7 becomes 0 and `1` renders as
  `1.41`, but the same number looks the same in every browser.
- **The filter bends pixels, it can't scale them.** That's why the loupe clones and
  CSS-scales the source instead of magnifying in the filter.
- **Glass needs bleed.** A filter can only bend pixels it was handed. A target that
  ends at the visible rim has nothing outside to pull in, so the edge smears.
- **A `<canvas>` or `<video>` behind glass re-filters every frame**, even when static.
  Glass over live DOM is free at rest; that's the other reason the WebGL entry point
  exists.
- **`backdrop-filter: url(#…)` parses everywhere and paints only in Chromium**, so the
  frost path checks the engine and falls back to `blur()`.
- **Don't verify Safari from a screenshot.** Its capture path isn't its compositing
  path, so the first bullet looks fine in an image and broken on screen. Playwright's
  WebKit doesn't reproduce it either.

The [full README](https://github.com/amir-abushanab/liquid-glass-js#gotchas) has the
measurements behind each.

## Links

- **Showcase & docs**: <https://amir-abushanab.github.io/liquid-glass-js/>
- **Full README**: <https://github.com/amir-abushanab/liquid-glass-js#readme>

## License

[MIT](./LICENSE) © Amir Abushanab. The filter-on-content technique was
popularized by Aave's
[_Building Glass for the Web_](https://aave.com/design/building-glass-for-the-web)
— worth a read.
