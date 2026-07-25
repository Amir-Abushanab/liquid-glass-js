# @liquidglassjs/qr

A procedural **liquid-glass QR code**: the WebGL escape hatch, built on
[`@liquidglassjs/core`](https://www.npmjs.com/package/@liquidglassjs/core).
This is the one package that pulls in `qrcode`, so core consumers never
install it.

<p align="center">
  <a href="https://amir-abushanab.github.io/liquid-glass-js/">
    <img src="https://raw.githubusercontent.com/Amir-Abushanab/liquid-glass-js/main/docs/media/qr.png" alt="A scannable glass QR code rendered by a WebGL shader" width="356">
  </a>
</p>

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
qr.reconfigure({/* live refraction / animation params */});
qr.dispose(); // (the handle is also callable, for backwards compatibility)
```

`value` is required — a QR with the wrong payload is worse than no QR.

### Enhance, don't replace

The glass QR needs **WebGL2**, and `mountGlassQR` throws where it isn't
available — Brave's fingerprinting shields block it, and privacy browsers are
over-represented in exactly the crypto/payments audiences that reach for a QR.

Unlike core's glass, which degrades to a frosted surface, a QR is a _functional_
element: if it fails, the payload is unreachable. So render a plain QR first and
upgrade it, rather than mounting the glass one and hoping:

```ts
import { mountGlassQR, isGlassQRSupported } from '@liquidglassjs/qr';

// #qr already contains a server-rendered <svg> QR.
if (isGlassQRSupported()) {
  document.querySelector('#qr-fallback').hidden = true;
  mountGlassQR(document.querySelector('#qr'), { value });
}
```

`isGlassQRSupported()` probes once and caches (it returns `false` on the server,
without caching, so the client re-probes after hydration). A failed mount unwinds
whatever it built, so a caught throw leaves no half-built DOM in your container.

### Shape

Modules are circles and the eyes are squircles by default. Both are tunable, and
so is the card — all four are shader uniforms or a CSS variable, so `reconfigure`
moves them live without rebuilding the QR:

```ts
mountGlassQR(el, {
  value,
  moduleRadius: 0, // module corners: 1 = circles (default) … 0 = sharp squares
  moduleScale: 1, // how much of its cell a module fills; ≈0.7 (gapped) by default
  eyeRadius: 0, // finder-eye corners: 0 = square … 1 = circle
  frameRadius: 0, // the card + tile radius; any CSS length, a number is px
});
```

Those four values together are a classic printed QR: sharp modules that touch,
square eyes, square card. Leave `eyeRadius` unset to keep the original eye
radii — a fixed px step that doesn't scale with `size`; setting it switches
every ring to proportional rounding, which does.

`frameRadius` just sets `--ps-qr-radius` on the root, so it also works under
`styles: false` as long as your stylesheet keeps the var (the tile's radius is
derived from it, inset by the card's padding).

One caveat on `moduleScale`: scanners sample the centre of each module, so
shrinking them much below the default trades away real-world scan margin —
small, low-contrast, or motion-blurred captures are the ones that suffer.

### Branding

The centre mark is yours:

```ts
mountGlassQR(el, { value, logo: myLogoElement }); // or a markup string
mountGlassQR(el, { value, logo: false }); // no mark; encodes the centre too
```

Reserving the centre costs error-correction budget, so it now follows `logo` —
`logo: false` stops punching the hole. Set `reserveCenter` explicitly for the
rare case where you want the gap without a mark. (`image` is the old name for
`reserveCenter`; it still works.)

Under a Trusted Types policy, pass a `Node` rather than a markup string — the
built-in mark is built with `createElementNS` and is unaffected either way.

### Content Security Policy

Mounting injects a `<style>` into `document.head`, which `style-src` blocks under
a strict policy. Either pass a nonce:

```ts
mountGlassQR(el, { value, nonce: cspNonce });
```

…or ship the stylesheet yourself and skip the injection:

```ts
import '@liquidglassjs/qr/css';

mountGlassQR(el, { value, styles: false });
```

### React

```tsx
import { GlassQR } from '@liquidglassjs/qr/react';

<GlassQR value="https://example.com" />;
```

`react >= 18` is an optional peer dependency (only for the `/react` entry). The
component mounts in an effect, so guard it with `isGlassQRSupported()` the same
way — an unsupported browser otherwise throws into your nearest error boundary.

## Links

- **Showcase**: <https://amir-abushanab.github.io/liquid-glass-js/>
- **Core docs**: <https://github.com/amir-abushanab/liquid-glass-js#readme>

## License

[MIT](./LICENSE) © Amir Abushanab. The glass technique traces back to Aave's
[_Building Glass for the Web_](https://aave.com/design/building-glass-for-the-web).
