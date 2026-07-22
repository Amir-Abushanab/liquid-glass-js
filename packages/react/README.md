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

`GlassText`, `GlassShape`, `GlassLens`, `GlassButton`, and `GlassRipple` are
thin React bindings over the matching core renderers.

## Links

- **Showcase**: <https://amir-abushanab.github.io/liquid-glass-js/>
- **Core docs**: <https://github.com/amir-abushanab/liquid-glass-js#readme>

## License

[MIT](./LICENSE) © Amir Abushanab.
