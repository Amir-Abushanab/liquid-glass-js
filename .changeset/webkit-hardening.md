---
'@liquidglassjs/core': patch
---

Four WebKit hardenings, three of them found by an embedded browser wearing a
Chrome costume.

- **Never trust the UA string for an engine gate.** An embedded WebKit
  shipping a `Chrome/` UA passed `isChromium()` (running the Chromium-only
  paths in the one engine family whose filter coordinates break under them)
  AND failed `isWebKit()` (which required the ABSENCE of "Chrome", so the
  origin pin never applied and the filter split into a stuck layer plus a
  moving copy). Both gates now probe the engine: `isWebKit()` checks
  `webkitConvertPointFromNodeToPage` (WebKit-only, Blink never shipped it);
  `isChromium()` (exported) trusts `userAgentData.brands` (Blink-only API) and
  its UA fallback additionally requires `window.chrome` and no `Version/x`
  token.
- **The refract filter's region is explicit now.** It was the last renderer on
  the implicit form — a bbox region and a subregion-less `feImage` that "fills
  the filter region" — and engines don't compute that region identically: one
  placed it shifted, parking the map's neutral bleed over the card's left edge
  and its rim band mid-card. Both are explicit `userSpaceOnUse` pixels on the
  pinned element, the combination every other renderer already uses.
- **Regenerated maps decode before they swap in.** An undecoded `feImage`
  falls through to the neutral flood, so WebKit strobed flat/glass/flat on
  every per-move regenerate (merge groups) and flashed flat on every map-key
  reconfigure (lens tuning). Surfaces and lenses now build the new filter
  holder only once its bitmap is ready — the old glass stays up until the new
  one can paint, superseded by newer rebuilds and guarded against dispose.
- `buildDisplacementMap` caches identical option tuples in a small LRU (the
  generator is pure), and the loupe's param lists learned `profile` and
  `specularRotation` — a `profile` handed to `mountGlassLoupe` was previously
  dropped on the floor.
