---
'@liquidglassjs/core': patch
---

Astro + interactivity fixes from first-consumer feedback:

- Add the `astro-component` / `withastro` keywords so Astro auto-adds the package to `vite.ssr.noExternal` — importing the raw `.astro` adapters no longer dies in Vite SSR without a manual noExternal.
- The Astro adapter now writes `data-tint`, so an authored `tint` survives `mountGlassFromData` instead of being reset to the default at mount.
- `.ps-glass__content` is pointer-transparent only when a `.ps-glass__refract` layer sits beneath it (clicks must reach the live DOM being bent). On frost/backdrop surfaces the slotted content is the interactive surface, so nav links and buttons inside the glass now work without a consumer `pointer-events` override.
