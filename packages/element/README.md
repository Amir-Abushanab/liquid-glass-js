# @liquidglassjs/element

The `<liquid-glass>` custom element — drop-in **liquid glass** for Vue, Svelte,
Angular, plain HTML, or Astro, over
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
**light DOM** — the SVG path has to filter the element's real children, which a
shadow root would hide.

## Links

- **Showcase** — <https://amir-abushanab.github.io/liquid-glass/>
- **Core docs** — <https://github.com/amir-abushanab/liquid-glass#readme>

## License

[MIT](./LICENSE) © Amir Abushanab.
