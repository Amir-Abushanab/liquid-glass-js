# @liquidglassjs/core

SVG-first **liquid glass** for the web. The primary renderer is an SVG
`feDisplacementMap` applied to **live DOM**, so the glass runs in every modern
browser (Chrome, Safari, Firefox) with no flags, while the content underneath
stays selectable, scrollable, and clickable. WebGL and a procedural QR are
optional, code-split escape hatches for the two cases an SVG filter can't cover.

> **Credit.** The technique and several of the constants here are recreated
> from Aave's [_Building Glass for the Web_](https://aave.com/design/building-glass-for-the-web).
> Please read it; it is the source of this approach. If you use this package,
> keep the attribution to Aave intact.

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
`mountGlassDropdown`, `mountGlassLens`, `mountSvgRipple`.

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

## Links

- **Showcase & docs**: <https://amir-abushanab.github.io/liquid-glass/>
- **Full README**: <https://github.com/amir-abushanab/liquid-glass#readme>

## License

[MIT](./LICENSE) © Amir Abushanab. An independent implementation recreated from
Aave's _Building Glass for the Web_; please keep the Aave attribution intact.
