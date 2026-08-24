# @liquidglassjs/element

The `<liquid-glass>` custom element: drop-in **liquid glass** for Vue, Svelte,
Angular, plain HTML, or Astro, built on
[`@liquidglassjs/core`](https://www.npmjs.com/package/@liquidglassjs/core).

## Install

```sh
pnpm add @liquidglassjs/element @liquidglassjs/core
```

## Usage

Importing the package registers the element (a side effect). Import the chrome
CSS once too.

```js
import '@liquidglassjs/element';
import '@liquidglassjs/core/css';
```

```html
<liquid-glass radius="20" strength="16">
  <div class="ps-glass__refract"><!-- live DOM to bend --></div>
</liquid-glass>
```

Attributes map to core options (`radius`, `depth`, `dome`, `strength`, `edge`,
`glow`, `chroma`, `blur`, `tint`, `spec`, `vibrancy`, `backdrop`, `source`,
`mode`) and reconfigure the glass live. The renderer mounts on the element in
**light DOM**, because the SVG path has to filter the element's real children
and a shadow root would hide them.

## `<glass-loupe>`

The iOS "hold on a word" magnifier, on its own entry point so it only ships
where it's used.

```js
import '@liquidglassjs/element/loupe';
```

```html
<glass-loupe zoom="1.6" trigger="longpress">
  <article><!-- text to magnify --></article>
</glass-loupe>
```

Attributes: `zoom`, `width`, `height`, `offset-y`, `radius`, `strength`,
`chroma`, `blur`, `dome`, `depth`, `edge`, `glow`, `shade`, `trigger`
(`longpress` | `press` | `hover` | `none`), `long-press-ms`, `move-tolerance`,
`backdrop` (a CSS colour, or `none`), `glint`, and the opt-outs `no-snap`,
`no-clamp`, `allow-native`. With `trigger="none"` drive it through the element's
own `show(x, y)` / `move(x, y)` / `hide()` / `refresh()` methods.

## Links

- **Showcase**: <https://amir-abushanab.github.io/liquid-glass-js/>
- **Core docs**: <https://github.com/amir-abushanab/liquid-glass-js#readme>

## License

[MIT](./LICENSE) © Amir Abushanab.
