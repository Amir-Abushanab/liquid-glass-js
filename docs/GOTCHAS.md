# Gotchas

Things that bite when you put an SVG filter over live DOM. Most aren't specific to
this library — they're how the engines behave. Grouped by what you're doing, with
the engine named where only one of them does it.

Every claim here was measured; where a number appears, it came off rendered
pixels, not a spec. Extracted from the README when the list outgrew it.

### Using the library

- **Glass with nothing to refract is just a blur.** `mountGlass` picks its path in
  order: an explicit `refract` target, then a `source` plus WebGL2, then a `backdrop`,
  and if it was given none of those it falls back to a frosted `backdrop-filter`. That
  fallback refracts on Chromium and is a plain `blur()` everywhere else, so a surface
  that looks flat outside Chrome has usually just not been handed anything to bend.
  Give it the element behind it, or the page's own background.
- **Only three params are cheap to animate.** `strength`, `chroma` and `blur` land on
  a filter attribute, so driving them per frame costs about a `setAttribute` (~0.01ms).
  Everything else — `bevel`, `dome`, `depth`, `edge`, `glow`, `shade`, `radius`, and
  any resize — is an input to the displacement map, so each change re-encodes a PNG
  (~1.8ms on a lens, a third of a 60fps frame). Sweeping `strength` is a liquid pulse
  for free; sweeping `dome` the same way drops frames. `glassTween(instance).to({…})`
  eases the cheap ones for you and applies the rest in one go, so it can't be held
  wrong.
- **`blur` is quantised, and Safari can't blur below ~1.4px.** No engine applies a real
  Gaussian: all three approximate one with three integer-width box blurs, so the only
  radii that exist are `sqrt(d² - 1) / 2` — 1.41, 2.45, 3.46 and up. Chromium will use
  any width, Firefox runs a real Gaussian for small values, and Safari uses odd widths
  only and never below 3, which is why a `stdDeviation` of 0.4 is invisible in Chrome
  and a full blur in Safari. The library snaps `blur` to radii all three can hit: under
  ~0.7 you get 0, and `blur: 1` renders as 1.41.
- **A `<canvas>` or `<video>` behind glass re-filters every frame**, even when nothing
  moved. Over static DOM the browser caches filter output and the glass is free at rest;
  a volatile source throws that away. Pass it as `source` and take the WebGL path.
- **`backdrop-filter: url(#…)` parses everywhere and paints only in Chromium.** Safari
  and Firefox accept it and then draw nothing
  ([WebKit 245510](https://bugs.webkit.org/show_bug.cgi?id=245510)), so `CSS.supports()`
  can't tell you. You have to check the engine.
- **The filter bends pixels, it can't scale them.** There's no magnification in
  `feDisplacementMap`. To magnify, scale a copy of the content and put the filter over
  the copy — which is what the loupe does.
- **Round your dimensions.** A fractional size makes the map resample at about 1.0002,
  and that near-unity scale beats into faint moiré scanlines.
- **It's all browser-only.** Filters, canvas and `document` don't exist during SSR. Call
  from `useEffect`, `onMount` or a client `<script>`, never at module scope.

### Styling around the glass

Every one of these looks like the filter did something wrong, and none of them are the
filter.

- **Safari skips composited layers inside the glass.** The layer floats above it, sharp,
  while everything beside it bends. Three things promote an element: a running CSS
  transform animation, a running transform **transition** (a pill that slides on
  `transition: transform` counts, and it leaves the strip it vacated unrepainted), and a
  `<canvas>` redrawn every frame. Animate from script instead — setting
  `el.style.transform` each frame doesn't promote, and `will-change` on its own is fine
  — and either render canvas content as DOM or sample the canvas in WebGL.
- **`background-clip: text` cuts glyphs at the element box.** Filling glass letterforms
  with a gradient is the obvious way to make them read as glass, but the gradient only
  paints inside the background positioning area — the padding box — so any descender,
  swash or entry stroke that reaches past it is never filled and stops dead in a
  straight line. Pad the element out to the ink and take the same amount off the margin,
  so the paint area grows and the layout doesn't.
- **Some of what looks like the filter is the typeface.** A weight the family doesn't
  ship gets synthesised by smearing the outline, which blunts a tapered terminal into a
  flat stub — a script `q` then looks sliced off. And a script or display face's
  descenders routinely reach past `line-height` into the line below. Look at the glyphs
  with the filter removed before believing it.
- **A gradient painted into a 2D canvas turns colour emoji grey (Safari).** Every emoji
  drawn into that context afterwards comes out a grey silhouette. A flat translucent
  `fillRect` is fine, so it's gradients specifically. Bake the gradient into its own
  canvas and `drawImage` it in.
- **A live canvas keeps square corners inside rounded glass (Firefox).** The
  compositor ships the canvas's layer square: wrapper overflow, `border-radius` on
  the canvas, and even `clip-path` on the canvas are ALL skipped (verified windowed,
  Firefox 154 — and beware, headless/software WebRender renders it correctly, so a
  CI screenshot will swear it's fine). What works: force the element off the
  compositor fast path with a visually-no-op fully-opaque mask
  (`mask-image: linear-gradient(#000 0 0)`) — rasterized, the clip-path finally
  applies. The library sets clip-path everywhere and adds the mask Gecko-gated
  (`@supports (background-image: -moz-element(#a))`), since elsewhere it would only
  tax direct compositing. Applies to EVERY live canvas in rounded glass, not just
  the WebGL output — a rounded layer above a square one merely covers it until the
  day it doesn't.
- **`repeating-linear-gradient` dilutes a 1px hard stop (Firefox)** — but only enough to
  matter when the line was already faint. A hairline grid at 3.5% opacity disappears;
  the same grid at 12% is indistinguishable from the other engines (measured: peak
  brightness above its neighbours 17.6 in Firefox against 17.2 and 17.7 in Chromium and
  WebKit). So check before rewriting: if a low-alpha grid goes missing, build it from a
  plain `linear-gradient` repeated with `background-size`, and if it doesn't, leave it —
  `background-size` doesn't survive being passed as a `backdrop`, where the image list
  is painted at a fixed `cover`.

### Building your own filter chain

The library already handles all of these. They're here because they're invisible until
they bite, and because you'll hit them the moment you write your own `feDisplacementMap`.

- **Safari resolves `userSpaceOnUse` coordinates against the page**, not the element —
  the filter region and any primitive subregion alike — so the further down the page the
  element sits, the further off the map lands. Any transform on the element fixes it;
  `rotate: 0deg` is enough. `perspective` doesn't, which is the tell that this is about
  owning a coordinate system.
- **That transform breaks `background-attachment: fixed` on the same element.** A
  transformed element becomes the containing block for its own fixed backdrop, which
  squeezes the backdrop into the element box. If the element has one, add the element's
  document position to the filter's coordinates instead of transforming it.
- **Safari caches filter output by id.** Change a primitive's attributes and it keeps
  painting the result cached when that id was created, so anything driven through the
  filter per frame freezes at whatever it looked like on the first one. Re-inserting the
  node doesn't help and neither does nudging the element. Rename the filter and point
  the element at the new name.
- **On an inline `<svg>`, Safari reads filter coordinates in viewBox units.** Everywhere
  else they're CSS px, including Safari on an HTML element. A 64-unit viewBox drawn at
  200px makes every number in the filter three times too big. Multiply by
  `viewBoxWidth / cssWidth`.
- **A rim width in px only looks right at one stroke width.** Bevel a glyph or a mark
  with a fixed blur and it reads as a highlight on a heavy display face and swallows a
  light one whole — once the blur is wider than the stroke there's no flat interior
  left, so every pixel is an edge and the whole shape washes out. Scale the rim to the
  artwork: mean stroke width is `2 × area / total variation` of the coverage, one pass
  over the alpha you already rasterized. This library holds it between 1/8 and 1/3 of
  that, which is why one `bevel` works across families, weights and sizes.
- **A canvas can't see everything CSS did to your text.** `ctx.font` takes
  `font-style font-weight font-size font-family` and nothing else, so any property that
  changes the _used_ glyph size without changing the reported `font-size` — and
  `font-size-adjust` on a root element is a common one — leaves a canvas raster at the
  wrong scale. The error is per-glyph, so it accumulates: the first letter looks nearly
  right and by the last the map is a third of a word away. Measure the DOM's laid-out
  run and scale to match rather than trusting `font-size`.
- **A filter can only bend what you hand it.** If the target ends exactly at the visible
  rim there's nothing outside to pull inward, so the edge smears instead of refracting.
  Inset the target by a bleed margin and clip the extra ring away.
- **A filter region in `objectBoundingBox` units isn't the border box.** It's the ink
  bounding box, and the engines disagree about it by a pixel or two. If the size has to
  be exact, use `userSpaceOnUse`.
- **Give `feImage` an explicit subregion.** Without one it fills the filter region, so
  the map's size and position depend on whatever region the engine computed — and they
  don't compute the same one.

### Testing any of it

- **Don't trust a Safari screenshot.** Its capture path isn't its compositing path, so a
  screenshot shows a composited child refracted even when the live page doesn't. A
  conclusion drawn from a still image can be exactly backwards.
- **"WebKit" is not one renderer, and only Safari is Safari.** Playwright's WebKit has
  neither the filter cache nor the compositing behaviour, so it reproduces neither and
  will happily pass code that's broken in Safari. The embedded WebKit inside a dev tool
  or desktop app is a third variant again, and it can show you glass bugs Safari does
  not have — a filter that only renders correctly after something forces a rebuild, for
  instance. Before chasing a WebKit bug, check it in Safari itself: a fix for a
  behaviour only the harness has is a cost with no benefit.
- **Don't compare screenshots of anything animating.** Two captures from different
  engines are at different points in the animation, so they always differ and it tells
  you nothing. Freeze it first.
