# @amir-abushanab/liquid-glass

SVG-first **liquid glass** for the web. The primary renderer is an SVG
`feDisplacementMap` applied to **live DOM**, so the glass runs in every modern
browser (Chrome, Safari, Firefox) with no flags and no fallbacks to maintain,
and the content underneath stays selectable, scrollable, and clickable. WebGL
and a procedural QR are optional, code-split escape hatches for the two cases an
SVG filter can't cover.

> ## Credit
>
> The technique and several of the constants here (the `erf = tanh(√π·x)`
> approximation, the spherical-cap dome integral, the R/G/B displacement-map
> layout, the "fresh filter id per rebuild" Safari trick) are
> **reverse-engineered from Aave's _Building Glass for the Web_**:
> <https://aave.com/design/building-glass-for-the-web>. Please read it — it is
> the source of this approach. If you use this package, credit Aave too.

## Why SVG-first

The popular web-glass demos use `backdrop-filter: url()`, which is
Chromium-only. Aave's insight is to put the filter **on the content**
(`filter: url()` over the real DOM) instead of on the backdrop. That one change
is what makes it work in Safari and Firefox. WebGL is reserved for content an
SVG filter genuinely can't bend: a `<canvas>` with no live DOM, or a `<video>`
(WebKit refuses to filter video).

## Install

```sh
pnpm add @amir-abushanab/liquid-glass
```

`qrcode` (the only runtime dependency) is pulled in **only** by the `/qr` entry.

## Usage (vanilla)

```ts
import { mountGlass } from '@amir-abushanab/liquid-glass';
import '@amir-abushanab/liquid-glass/css'; // ship the .ps-glass* chrome once

const el = document.querySelector('.card');
const glass = mountGlass(el, { refract: el.querySelector('.card__content') });
// ...later
glass.dispose();
```

`mountGlass(root, opts)` builds its own chrome layers and auto-selects the
renderer (`mode: 'auto'`):

1. **`refract` element present** → SVG filter on the live DOM (the primary path). Wins over everything.
2. **`source` (canvas/video/img) + WebGL2** → WebGL (lazily imported).
3. **`backdrop` (CSS background)** → SVG filter on a viewport-locked clone.
4. **otherwise** → frosted `backdrop-filter` (last resort).

`mode` can force `'svg' | 'webgl' | 'frost'`. WebGL degrades to frost if WebGL2
is unavailable or the renderer throws.

## Entry points (the code-split)

| Import | Ships | Notes |
|---|---|---|
| `@amir-abushanab/liquid-glass` | `mountGlass` + every SVG-path renderer (`mountGlassLens`, `mountSvgRipple`, `mountGlassText`, …) | **No WebGL, no `qrcode`.** WebGL is lazy-imported at runtime only if a surface hits that path. |
| `@amir-abushanab/liquid-glass/webgl` | `GlassGL` (the WebGL renderer) | Its own chunk. |
| `@amir-abushanab/liquid-glass/qr` | `mountGlassQR` + the QR internals | The only entry that references `qrcode`. |
| `@amir-abushanab/liquid-glass/css` | the `.ps-glass*` styles | Import once per app. |

The split relies on the **consumer's** bundler (Vite / webpack / Rollup split by
default; esbuild needs `--splitting`). Subpath entries are belt-and-suspenders
on top of the internal dynamic `import()`: a consumer who only imports `.` never
references WebGL or QR.

## Astro

```astro
---
import LiquidGlass from '@amir-abushanab/liquid-glass/astro/LiquidGlass.astro';
import LiquidGlassFont from '@amir-abushanab/liquid-glass/astro/LiquidGlassFont.astro';
---
<LiquidGlass radius={20} strength={16}>
  <slot name="refract"><!-- live DOM to bend --></slot>
  <!-- default slot: overlay content -->
</LiquidGlass>
```

## Theming

The CSS is de-themed — it reads namespaced vars with sane fallbacks, so nothing
app-specific is assumed. Override per surface or globally:

| Var | Role | Default |
|---|---|---|
| `--glass-paper` | base "paper" behind the tint + SVG clone | `#fff` |
| `--glass-ink` | rim ink | `#000` |
| `--glass-frost-bg` | frosted-fallback background | `rgb(255 255 255 / 55%)` |
| `--glass-backdrop` | default backdrop for the SVG-clone path | consumer-supplied |

```css
.ps-glass { --glass-paper: var(--paper); --glass-ink: var(--ink); }
```

## Browser-only

Every renderer touches `document` / canvas / WebGL / SVG filters. Guard adapters
so they run client-side only (Astro `<script>` is fine; React needs `useEffect`;
never call these during SSR).

## License

[MIT](./LICENSE) © Amir Abushanab.

**Provenance note:** this is an independent reimplementation, but the technique
and several constants are derived from Aave's _Building Glass for the Web_ (see
[Credit](#credit)). The MIT license covers this implementation; it does not
grant any rights in Aave's original work. If you plan to redistribute or publish
this, review Aave's terms and keep the attribution above intact.
