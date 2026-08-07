---
'@liquidglassjs/core': patch
---

Fix the frost fallback never engaging on Safari and Firefox.

`mountGlass`'s frost path has always had two branches: Chromium gets a refractive
frost (the same `feDisplacementMap` run over the live page behind the surface),
and everything else gets a plain `blur()`. The gate that chose between them was
`CSS.supports('backdrop-filter', 'url("#a")')` — and that check can't gate
anything, because it only *parses*. Safari and Firefox both accept `url()` in the
backdrop-filter grammar while painting nothing for it ([WebKit bug 245510][wk],
open since 2022; [mdn/browser-compat-data#24110][bcd]).

So the probe returned `true` in all three engines, the `blur()` branch was
unreachable, and Safari and Firefox took the refractive path — where they got no
frost at all. Not a degraded frost: a flat translucent panel with the content
behind it showing through razor-sharp, since the only filter they were given was
one they don't render.

The gate now also requires a Chromium engine. There is no capability probe
available here — DOM has no pixel readback, so nothing can observe that a
backdrop filter painted — which leaves the engine as the only signal;
`navigator.userAgentData` is Chromium-only and cheaper than a UA regex, with a UA
fallback for non-secure contexts where it's undefined. Both failure directions
are safe: a false negative yields the plain frosted blur, which is the intended
fallback anyway.

Only the frost path is affected. `filter: url()` over live DOM — `mountGlassLens`,
`mountDomRefract`, and the `backdrop` clone path — renders correctly in Chromium,
Firefox and WebKit alike, and is unchanged; it never consulted this probe. The
asymmetry is specifically that WebKit and Gecko ship SVG filter references for
`filter` but not for `backdrop-filter`.

[wk]: https://bugs.webkit.org/show_bug.cgi?id=245510
[bcd]: https://github.com/mdn/browser-compat-data/issues/24110
