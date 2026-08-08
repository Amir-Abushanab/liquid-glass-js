# @liquidglassjs/react

The React wrapper for **liquid glass**: a `<LiquidGlass>` component, a
`useLiquidGlass` hook, and effect bindings over
[`@liquidglassjs/core`](https://www.npmjs.com/package/@liquidglassjs/core).

## Install

```sh
pnpm add @liquidglassjs/react @liquidglassjs/core
```

`react >= 18` is a peer dependency.

## Usage

```tsx
import { LiquidGlass } from '@liquidglassjs/react';
import '@liquidglassjs/core/css'; // once, app-wide

export function Card() {
  return (
    <LiquidGlass radius={20} strength={16}>
      <div className="ps-glass__refract">{/* live DOM to bend */}</div>
    </LiquidGlass>
  );
}
```

Headless variant: attach the returned ref to your own element.

```tsx
import { useLiquidGlass } from '@liquidglassjs/react';

const ref = useLiquidGlass<HTMLDivElement>({ radius: 20 });
return <div ref={ref}>…</div>;
```

Both are SSR- and StrictMode-safe: the glass mounts in an effect and fully
disposes on cleanup.

### Effect components

`GlassText`, `GlassShape`, `GlassLens`, `GlassLoupe`, `GlassButton`, and
`GlassRipple` are thin React bindings over the matching core renderers.

### The loupe

`<GlassLoupe>` is the iOS "hold on a word" magnifier — long-press its children
and a glass capsule floats above the pointer, magnifying the line under it.

```tsx
import { GlassLoupe } from '@liquidglassjs/react';

<GlassLoupe as="article" zoom={1.6} onMove={({ caret }) => setCaret(caret)}>
  {post.body}
</GlassLoupe>;
```

`useGlassLoupe(ref, options)` is the headless form: point it at content you
already render, and with `trigger: 'none'` drive it from your own gesture.

```tsx
const ref = useRef<HTMLElement>(null);
const loupe = useGlassLoupe(ref, { trigger: 'none', zoom: 2 });
// loupe.current?.show(e.clientX, e.clientY)
```

See the [core docs](https://www.npmjs.com/package/@liquidglassjs/core) for what
the clone does and does not capture, and why a long-press loupe has to suppress
the platform's own selection UI.

## Links

- **Showcase**: <https://amir-abushanab.github.io/liquid-glass-js/>
- **Core docs**: <https://github.com/amir-abushanab/liquid-glass-js#readme>

## License

[MIT](./LICENSE) © Amir Abushanab.
