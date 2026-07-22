# @liquidglassjs/qr

A procedural **liquid-glass QR code**: the WebGL escape hatch, built on
[`@liquidglassjs/core`](https://www.npmjs.com/package/@liquidglassjs/core).
This is the one package that pulls in `qrcode`, so core consumers never
install it.

> **Credit.** Recreated from the technique in Aave's
> [_Building Glass for the Web_](https://aave.com/design/building-glass-for-the-web).

## Install

```sh
pnpm add @liquidglassjs/qr @liquidglassjs/core
```

## Usage

```ts
import { mountGlassQR } from '@liquidglassjs/qr';

const qr = mountGlassQR(document.querySelector('#qr'), {
  value: 'https://example.com',
});
qr.reconfigure({
  /* live refraction / animation params */
});
qr(); // the handle is callable: calling it disposes
```

### React

```tsx
import { GlassQR } from '@liquidglassjs/qr/react';

<GlassQR value="https://example.com" />;
```

`react >= 18` is an optional peer dependency (only for the `/react` entry).

## Links

- **Showcase**: <https://amir-abushanab.github.io/liquid-glass/>
- **Core docs**: <https://github.com/amir-abushanab/liquid-glass#readme>

## License

[MIT](./LICENSE) © Amir Abushanab.
