# @liquidglassjs/core

## 0.1.1

### Patch Changes

- [`5568632`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/55686326ab2ccac64b7d17a7da890a9490ce4559) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Astro + interactivity fixes from first-consumer feedback:

  - Add the `astro-component` / `withastro` keywords so Astro auto-adds the package to `vite.ssr.noExternal` — importing the raw `.astro` adapters no longer dies in Vite SSR without a manual noExternal.
  - The Astro adapter now writes `data-tint`, so an authored `tint` survives `mountGlassFromData` instead of being reset to the default at mount.
  - `.ps-glass__content` is pointer-transparent only when a `.ps-glass__refract` layer sits beneath it (clicks must reach the live DOM being bent). On frost/backdrop surfaces the slotted content is the interactive surface, so nav links and buttons inside the glass now work without a consumer `pointer-events` override.
