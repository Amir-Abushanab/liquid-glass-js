# @liquidglassjs/core

## 0.5.1

### Patch Changes

- [#10](https://github.com/Amir-Abushanab/liquid-glass-js/pull/10) [`000dd35`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/000dd35ca534be24279cff09df4c1b9f6b9a214b) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Frost: suspend refraction while the box is resizing

  A `url()` backdrop-filter re-rasterises the whole backdrop through the filter
  graph on every frame the element changes size, so animating a frosted surface's
  height — a disclosure panel inside a glass navbar, say — ran at a fraction of
  the frame rate. Growing a navbar 60→391px on a 4×-throttled Pixel 7: median
  frame 25.1ms (~20fps), worst 66ms.

  `mountFrost` now falls back to the plain frosted blur — exactly what WebKit and
  Gecko are served permanently — for the duration of the resize, and restores the
  lens 120ms after the box settles. Same measurement: median frame 8.3ms, the
  same number as no backdrop-filter at all. Resting appearance is unchanged.

  The cost is the raster, not the map: rendering the displacement map at half
  resolution (10× cheaper to build, 0.08% different) changed nothing, and neither
  did cutting rebuilds from 11 to 4 — hence suspending the effect rather than
  optimising the rebuild.

## 0.5.0

### Minor Changes

- [#6](https://github.com/Amir-Abushanab/liquid-glass-js/pull/6) [`893eab7`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/893eab79d8533926d781ab46f999ef684869c2ac) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Add the glass loupe — the iOS "hold on a word" magnifier.

  `mountGlassLoupe({ source, zoom, trigger })` opens a glass capsule above the
  pointer showing the line under it, blown up and refracting at the rim. React gets
  `<GlassLoupe>` and `useGlassLoupe`; `@liquidglassjs/element/loupe` registers a
  `<glass-loupe>` custom element on its own entry point, so it only ships where
  it's used.

  The constraint that shapes the whole thing: `feDisplacementMap` **bends** pixels
  and can never scale them, so the magnification cannot come from the filter. The
  loupe deep-clones the source, scales the clone with a CSS transform, and mounts
  the existing `mountGlassLens` on that copy. Keeping the magnified content as DOM
  rather than a rasterized snapshot is the point — glyphs rasterize at their final
  size and stay sharp at any zoom, which is exactly what a magnifier is for.

  Three details that aren't obvious:

  - **The bleed ring.** An SVG filter can only bend pixels it was handed. With the
    filter target ending at the visible rim there is nothing outside to pull inward,
    and the edge smears instead of refracting. The target is inset by `-bleed` on
    every side and the lens is positioned at `(bleed, bleed)` — the same trick
    `.ps-glass__refract` plays with `--g-margin` — and the extra ring is clipped away
    by the capsule.
  - **The top layer.** A loupe clipped by an ancestor's `overflow: hidden` is a dead
    feature, but re-parenting the clone to `<body>` would drop every descendant
    selector styling it. A `popover` gets both: top-layer painting escapes all
    clipping and stacking contexts while the element stays where it is in the DOM, so
    the clone keeps its real ancestors for inheritance and selector matching. The
    `[popover]` UA sheet is neutralised on mount — including its `color: canvastext`,
    which would otherwise repaint the clone's text in the UA's colour.
  - **The native loupe.** With `trigger: 'longpress'`, iOS Safari answers the same
    gesture with its own loupe and callout bar, on top of ours, so the source's native
    selection UI has to be suppressed. Only the touch-only properties
    (`-webkit-touch-callout`, `touch-action`) sit on the element for the whole mount;
    `user-select` is scoped to the gesture, because taking it at mount time costs a
    mouse user the ability to select text on that element at all. On touch it's taken
    at pointerdown (a drag scrolls there anyway); with a mouse it waits until the hold
    has actually won, so press-and-drag still selects and only a still hold becomes a
    loupe. `suppressNative: false` with `trigger: 'none'` and your own gesture opts out
    of all of it.

  `snapToLine` (default on) pins the sample to the text line's centre and reports
  the caret under the pointer, so a selection UI can ride along. Every param tunes
  live through `reconfigure()` — `longPressMs` included, since it's read at
  pointerdown — and only the ones baked into the displacement map cost a rebuild.
  The clone is sized from the fractional `getBoundingClientRect()` rather than
  `offsetWidth`/`offsetHeight`: a third of a pixel of rounding is enough to reflow a
  line or re-balance a multi-column source, at which point the copy shows different
  text from the original at the same coordinates. The clone is a
  snapshot taken on open — canvas bitmaps, form values and scroll offsets are copied
  across, `<video>` frames are not, and `refresh()` re-reads a changed source. When
  the source has no background of its own, the capsule is filled with the nearest
  opaque background colour above it, so the magnified text doesn't float over a
  see-through hole showing the page at 1×.

- [#6](https://github.com/Amir-Abushanab/liquid-glass-js/pull/6) [`78aff49`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/78aff497958559119ae86e82402e1cb0615b5bb6) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Retune `GLASS_TEXT_DEFAULTS`. Glass letterforms now default to a domed, bevelled
  treatment rather than a refracting one — the displacement is turned almost all the way
  down and the shaping is turned up.

  | param      | was  | now |
  | ---------- | ---- | --- |
  | `strength` | 8    | 0.5 |
  | `chroma`   | 0.4  | 1   |
  | `blur`     | 0.3  | 1.2 |
  | `bevel`    | 2.5  | 1.3 |
  | `dome`     | 4    | 12  |
  | `edge`     | 0.9  | 1.5 |
  | `glow`     | 0.35 | 1   |
  | `shade`    | 0    | 1   |

  At display sizes a strong displacement fights the letterform — the counters distort
  and the type stops reading as type. Dome, edge, glow and shade shape the glyph as a
  solid piece of glass instead, which holds up better the larger it gets. Pass explicit
  params to `mountGlassText` for the old look.

  `GLASS_SHAPE_DEFAULTS` is unchanged. Logos and marks are arbitrary artwork rather than
  letterforms, and they still want the refraction.

- [#6](https://github.com/Amir-Abushanab/liquid-glass-js/pull/6) [`5bba5ff`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/5bba5ffc7283b8bb02618d5822fff76a5322b6f4) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Add `glassTween` — ease a refraction param from one value to another, for hover,
  press, focus, or anything else with two states.

  ```js
  const glass = mountGlassText({ target: h1, host: h1, strength: 4 });
  const tween = glassTween(glass, { duration: 320 });
  h1.addEventListener('pointerenter', () => tween.to({ strength: 12.5 }));
  h1.addEventListener('pointerleave', () => tween.to({ strength: 4 }));
  ```

  Works on any renderer — text, shape, lens, morph surface — since they all carry the
  same `reconfigure`/`getOptions` pair. Calling `to()` mid-flight retargets from the
  current value rather than snapping back to the start, so hovering in and out faster
  than the duration stays continuous. `prefers-reduced-motion: reduce` jumps to the
  target, read per call so toggling the OS setting needs no reload.

  It is deliberately not a preset library. `duration` and `easing` are the app's;
  `cubicBezier` is exported if you want the soft overshoot the built-in controls use.
  What it does carry is the one thing the library knows and the caller can't see: which
  params are safe to write every frame. `strength`, `chroma`, `blur` and `spec` set a
  filter attribute (~0.01ms); everything else is an input to the displacement map and
  re-encodes a PNG (~1.8ms on a lens). So the tween eases the first group and applies the
  second once, up front — the shape snaps and the refraction eases into it, which is the
  right way round anyway: a bevel morphing mid-hover reads as a glitch, a deepening bend
  reads as glass.

- [#7](https://github.com/Amir-Abushanab/liquid-glass-js/pull/7) [`d7f48d6`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/d7f48d6289308f05bfdb894ecbff396e2d76b691) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Honour the OS legibility and motion settings, following Apple's own tiers for
  Liquid Glass: reduced transparency goes frostier, increased contrast goes
  mostly solid with a contrasting border, reduced motion "disables any elastic
  properties".

  - The shipped CSS answers `prefers-reduced-transparency: reduce` (tint raised
    to 80% paper) and `prefers-contrast: more` (92% paper + a 1.5px 70%-ink
    rim). Both key off `--glass-paper`/`--glass-ink`, so themed consumers keep
    their palette. The query split is deliberate: Safari has never shipped
    `prefers-reduced-transparency`, so `prefers-contrast` is the tier Safari
    users can actually reach.
  - All built-in motion — `glassTween`, `createSpring`, the button/dropdown
    morphs, the ripple bloom — honours `prefers-reduced-motion` on its own
    (state changes land, bounces don't; the ripple, pure ornament, is skipped
    whole). `prefersReducedMotion()` is exported for hand-rolled rAF loops.

- [#7](https://github.com/Amir-Abushanab/liquid-glass-js/pull/7) [`d7f48d6`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/d7f48d6289308f05bfdb894ecbff396e2d76b691) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Merged glass: `mountGlassGroup` gives several elements ONE displacement map
  whose rounded-rect SDFs fuse by smooth-min — Apple's droplet merge
  (GlassEffectContainer's spacing), in pure SVG. Bring one item within about
  `blend / 2` px of another and their rims flow together through a neck,
  refraction and glint following the fused silhouette; the CSS "gooey" trick
  merges only the alpha silhouette, and nothing else in the field fuses the
  refraction fields themselves.

  The generator (`renderGroupDisplacementMap`, exported) evaluates the merged
  SDF into per-cluster field patches (far-apart shapes cost two small patches,
  not one rect spanning the gap), takes displacement direction from the field's
  gradient so the normal rotates smoothly through the neck, feathers the
  silhouette by one pixel of SDF coverage (the antialias a supersampled
  downscale would produce, at 1× cost), and supports both rim profiles. Groups
  are bevel-only — a union has no centre to dome from — and carry their own
  `shade` (dark occlusion rim baked into the map, the stand-in for per-element
  inset-shadow chrome, which would draw straight through a merged neck) and
  `blend`.

  Items are chrome above the refracted pane, never filtered themselves, so
  sliding one with a transform is safe under Safari's composited-child rule;
  they are measured transforms-included, and `update()` is rAF-coalesced and
  keyed at half-pixel so unmoved frames cost nothing.

  `specularRotation` (light angle, degrees) also becomes a live-tunable param on
  the lens, loupe and group — a map key, documented to be driven quantized when
  tied to pointer bearing or device tilt; the light-follows-the-world idea is
  clayharmon's webgl-liquid-glass.

- [#8](https://github.com/Amir-Abushanab/liquid-glass-js/pull/8) [`52b7bfe`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/52b7bfe424540a36b1a2482712b4812397394148) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - `behind`: glass over live page content it doesn't own — the floating-navbar
  case — now refracts for real on Firefox.

  Pass `behind` (an element or selector; a SIBLING scene, not an ancestor) and
  on Gecko the surface's background becomes `-moz-element()` of that element — a
  LIVE image of real DOM, so things scrolling, animating or playing beneath the
  glass show through bent, with no clone to sync and no snapshot to go stale.
  Alignment is pure `background-position` (the source's viewport offset minus
  the surface's), rewritten rAF-coalesced on scroll and resize; the filter is
  the ordinary displacement chain with the explicit userSpaceOnUse region.

  Coverage for the navbar case becomes: Chromium ✓ (the frost path's
  `backdrop-filter: url()` already refracts the real page — `behind` falls
  through to it), Firefox ✓ (this path), WebKit ✗ (no backdrop route exists;
  bug 245510 — stays on the frosted blur).

  The module is lazy-imported behind a capability probe
  (`CSS.supports('background-image', '-moz-element(#a)')`) exactly like the
  WebGL escape hatch — bundlers can't tree-shake by runtime engine, so the
  code-split is ours, and non-Gecko users download none of it. `-moz-element()`
  is prefixed and non-standard; if Firefox ships `feDisplacementMap` inside
  `backdrop-filter` (the WebRender follow-up Mozilla has invited patches for),
  this path retires in favour of the native one.

  A standalone bench ships at `/behind` in the showcase — open it in Firefox,
  Chrome and Safari side by side: a fixed glass bar over a page with a ticking
  clock and a sliding marquee, which stay live through the bend where the
  engine can and report which path mounted.

- [#7](https://github.com/Amir-Abushanab/liquid-glass-js/pull/7) [`d7f48d6`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/d7f48d6289308f05bfdb894ecbff396e2d76b691) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - The glass can energize under the pointer.

  - `GlassLens.setDisplScale(frac)`: a cheap per-frame multiplier on the three
    displacement scales — attribute writes plus the Safari id re-point, never a
    map rebuild.
  - `createSpring(initial, onUpdate, {stiffness, damping})`: a scalar
    semi-implicit-Euler spring with the timestep clamped to 20ms substeps (one
    slow frame integrated whole diverges — spring force grows with distance) and
    a rAF loop that sleeps at settle. `set()` honours
    `prefers-reduced-motion` by snapping; `snap()` is the explicit no-animation
    path. Exported alongside `prefersReducedMotion()`.
  - React `<GlassLens press={1.25}>`: the boost springs in while the pointer is
    held and out on release. Default 1 keeps existing lenses pixel-identical.

  The spring-into-the-displacement-scale idea is ZeroxyDev's liquid-glass-js
  `refractionBoost`; the substep clamp is a lesson from clayharmon's
  webgl-liquid-glass.

- [#7](https://github.com/Amir-Abushanab/liquid-glass-js/pull/7) [`d7f48d6`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/d7f48d6289308f05bfdb894ecbff396e2d76b691) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Add `profile: 'erf' | 'circle'` — the rim's falloff curve — to every
  rounded-rect surface (mount, lens, loupe, button, dropdown, the element's
  attribute, and the React bindings).

  `'circle'` is the quarter-circle bevel `i = 1 − √(1 − t²)` on the outer SDF:
  displacement peaks at exactly 100% at the rim with a vertical tangent — the
  crisp iOS-style compression ring — and lands at zero at the depth band's inner
  edge, so nothing leaks inward and mid-panel text stays undistorted however hard
  the rim bends. It is the curve Kyant0's AndroidLiquidGlass screenshot-verified
  against iOS 26, and the shape kube.io's ray-traced Snell maps arrive at from
  first principles. `'erf'` stays the default and is byte-identical to what the
  library has always rendered: a soft meniscus that reaches ~0.92 at the rim and
  bleeds about two band-widths into the interior.

  `profile` is a map input — reconfiguring it re-encodes the PNG — so it joins
  the map-key lists everywhere `reconfigure()` exists.

- [#7](https://github.com/Amir-Abushanab/liquid-glass-js/pull/7) [`d7f48d6`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/d7f48d6289308f05bfdb894ecbff396e2d76b691) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - `supersample` (default 1 = off, clamp 3) on the live-DOM refract path: the
  content lays out at its natural size, an inner `scale(G)` blows it up into the
  filtered layer, and `scale(1/G)` brings the filtered result back down, so the
  whole chain — source raster, blur, displacement, recomposite — runs on a G×
  raster and displaced small text keeps its subpixel antialiasing. Chromium-only
  (elsewhere the filter runs in software and G² pixels quadruple a slow path;
  the option silently stays 1×), and it needs the standard
  `__refract`/`__refract-inner` pair. Adapted from @samasante/liquid-glass's
  `filterResolution`. Honest note: on a retina display with the flat-middle
  profiles the difference is confined to the bent rim band — its niche is heavy
  bend through text on 1× displays.

### Patch Changes

- [#6](https://github.com/Amir-Abushanab/liquid-glass-js/pull/6) [`98b1460`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/98b1460f8b950bd080c43229e1ee54c4cdc9b24e) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Don't apply an alpha-glass filter until its map has decoded, and re-point it when the
  element comes into view. Fixes glass text and glass marks below the fold rendering
  flat on first sight and only coming good once something rebuilt them.

  The map is a data-URL PNG handed to `feImage`, and an `feImage` that hasn't decoded yet
  contributes nothing: `feComposite in="rawMap" in2="mapBg" operator="over"` falls
  through to the neutral flood, every displacement is zero, and the glyphs paint flat and
  unrefracted. Unlike the lens, this chain is built once and never re-runs on its own, so
  it stays wrong until something else rebuilds it — which is why switching typeface and
  back "fixed" it. `regen` now awaits `img.decode()` before applying the filter, with a
  generation check so a newer map can overtake an older one mid-await.

  Second, Safari keys filter output by id (see `refreshGlassFilter`). An element that
  mounted below the fold can be painted from what was cached before it was ever on
  screen, and nothing in this renderer would ask again. An `IntersectionObserver` now
  re-points the filter on entry — a rename, so no map is re-encoded, and a no-op off
  WebKit. Verified: entering the viewport takes the filter id from `-1` to `-2` in
  WebKit and leaves it untouched in Chromium and Gecko.

  Both are first-paint races that a headless harness doesn't reproduce — twelve of twelve
  maps already measured decoded there — so this is aimed at the two mechanisms that fit
  the symptom rather than at a reproduction.

- [#6](https://github.com/Amir-Abushanab/liquid-glass-js/pull/6) [`3ab6fed`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/3ab6fed930384626ae87270d24a528c7104a21da) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Stop the glass root's stylesheet from overriding a position the consumer already
  chose. A `<LiquidGlass className="absolute inset-0">` was silently collapsing to zero
  height and rendering no glass at all.

  `.ps-glass` is added to the root by `mountGlass`, so it arrives alongside whatever
  classes the consumer put there — and the stylesheet declared `position: relative` on
  it. That is unwinnable from CSS: Tailwind v4 puts its utilities in `@layer utilities`,
  **unlayered CSS beats any layer regardless of specificity**, and this sheet is
  unlayered, so `.ps-glass` overrode `.absolute` even when rewritten as `:where(.ps-glass)`
  at zero specificity. With `position: relative` in force, `inset-0` stops sizing the
  element, it collapses to zero height, and every renderer bails before building a filter
  — glass that isn't there, with nothing in the console to say so.

  The surface, tint and rim are positioned against the root, so it does have to be a
  containing block — but _any_ non-static position is one, and `absolute` is a perfectly
  good answer. `position` is out of the stylesheet; `mountGlass` fills it in from script
  only when the computed position is still `static`. One `getComputedStyle` read at
  mount, and the consumer's choice always wins.

  The rest of the root rule (radius, overflow, isolation) moves to `:where()` while it's
  being touched — those are defaults, not decisions.

- [#6](https://github.com/Amir-Abushanab/liquid-glass-js/pull/6) [`f9d2128`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/f9d212824796c7bb52c854f272406ab8bb3f1951) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Rasterize glass text at the size the browser actually drew it, not the size CSS
  reports. Fixes the map sliding out from under the letters — worse the further along
  the line you look — on any page that sets `font-size-adjust`.

  A canvas 2D context understands `font-style font-weight font-size font-family` and
  nothing else. CSS has properties that change the _used_ glyph size without changing
  the reported `font-size`, and `font-size-adjust` is the common one: `from-font` on a
  root element normalises x-height across fallback faces, so switching family silently
  rescales every glyph. `mountGlassText` composed its canvas font from the computed
  longhands, which don't carry that, so the raster came out at the wrong scale.

  Measured on one 64px element under `font-size-adjust: from-font`, DOM run width vs
  canvas run width for the same font shorthand:

  | face   | DOM   | canvas | error              |
  | ------ | ----- | ------ | ------------------ |
  | mono   | 370.1 | 384.0  | canvas 3.6% wide   |
  | serif  | 374.5 | 351.1  | canvas 6.6% narrow |
  | script | 406.1 | 282.0  | canvas 44% narrow  |

  The error is per-glyph and so accumulates along the run: the first letter looks nearly
  right and the last one has the glass a third of a word away from it. Identical in
  Chromium, WebKit and Gecko — it is not an engine bug, it is a missing property.

  Rather than reimplement the causes, `mountGlassText` now measures the outcome. It
  clones the element (so every inherited property still applies), strips `letter-spacing`
  (an absolute length, which must not be scaled), lays it out, and compares that width to
  what the canvas makes of the same font. The ratio scales the canvas font size. A ratio
  outside 0.25–4 means the clone didn't lay out like the original, and the CSS value is
  used unchanged.

  This also covers synthesised weights and anything else that alters the used size, since
  it never asks _why_ the two disagree.

- [#6](https://github.com/Amir-Abushanab/liquid-glass-js/pull/6) [`fbb347a`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/fbb347a39f7b1fcce277c6621e77893449f71061) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Size the glyph map's margin from the measured ink instead of a flat `0.2em`, so faces
  with reach — script, swash italics, anything with a long descender — stop having their
  tails cut off square.

  The map has to cover the ink, and a line box does not: a font's ascent and descent are
  its own business and routinely exceed `line-height`. `0.2 × fontSize` is fine for the
  mono and sans faces it was measured on. A script face at 57.6px wants **22px** below
  the element box against a **19px** margin, and loses 3px off every descender.

  `buildGlyphDisplacementMap` now measures the run's ink box and takes the largest
  overflow on any side — above the box top, below the bottom, left of the origin (script
  entry strokes), past the advance (swashes, italics) — plus 2px of slack for the outer
  end of the bevel ramp. The old `0.2em` stays as a floor, so an engine that doesn't
  report `actualBoundingBox*` keeps the previous behaviour. On the same script heading
  the margin goes 19 → 27 and the ink fits; a mono heading is unchanged at 15, its ink
  sitting 11px inside the box on every side.

  Measure at the size being rasterized, not the one CSS reports — those differ wherever
  `font-size-adjust` is in play, and measuring at the wrong one is how this was missed.

- [#6](https://github.com/Amir-Abushanab/liquid-glass-js/pull/6) [`bfef218`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/bfef21809b6628060cef4188c1e7abb50f24b36e) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Size the displacement map from the element's layout box rather than its transformed
  rect. Fixes glass mounted inside a panel that animates in from a scale — a dialog, a
  menu, a popover — baking a map at the animation's start size and keeping it, so the
  rim traces a rounded rectangle a few px inside the panel it belongs to.

  All three render paths measured with `getBoundingClientRect()`, which reports the
  _transformed_ box. A popup entering from `scale(.95)` is at 95% for the frame the glass
  mounts on, so a 512x218 panel produced a 486x207 map. The transform then settles at
  100% without touching the layout box, so no `ResizeObserver` fires and nothing rebuilds
  it. Stretched back across the full element, the map's rim and dome land inset from the
  real edge and the surface reads as two rounded rectangles that don't line up.

  `offsetWidth`/`offsetHeight` are the layout box and are immune to transforms, which is
  exactly the invariant wanted here: the map depends on the element's shape, not on where
  a compositor happens to be drawing it this frame. Inline and SVG hosts have no offset
  box, so those fall back to the rect as before.

- [#6](https://github.com/Amir-Abushanab/liquid-glass-js/pull/6) [`12937f5`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/12937f51a6b7c6ed31be4628490940f3bc716563) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Give `mountGlassLens` and the morph surface the attribute-only `reconfigure` path
  `mountGlassText` already had, so `strength`, `chroma` and `blur` can be driven per
  frame on every renderer instead of just one.

  Those three only ever land on a filter attribute — `feDisplacementMap`'s `scale` and
  `feGaussianBlur`'s `stdDeviation`. The rest of the params are inputs to the
  displacement map, so changing one has to re-encode a PNG. `mount-alpha-glass` has
  split the two since it was written; the lens and the morph surface called `rebuild()`
  for any param at all, which meant animating `strength` on a lens quietly rasterized a
  new map sixty times a second.

  Measured as ms per `reconfigure`, 60 calls back to back so nothing is coalesced:

  | target        | param      | before | after    |
  | ------------- | ---------- | ------ | -------- |
  | lens          | `strength` | 1.87   | **0.01** |
  | lens          | `chroma`   | 1.98   | **0.01** |
  | lens          | `dome`     | 1.80   | 1.84     |
  | lens          | `radius`   | 1.73   | 1.81     |
  | morph surface | `strength` | 0.65   | **0.02** |
  | morph surface | `dome`     | 0.72   | 0.66     |

  The map params are unchanged, as they should be — they still rebuild, because they
  still have to.

  The attribute writes go through `refreshGlassFilter`, so Safari re-runs the filter
  rather than painting the output it cached when the id was minted.

  No animation presets ship with this: curves and timings belong to the app. What the
  library can say is which params are safe in a `requestAnimationFrame` loop, and now
  the answer is the same for every renderer — `strength`, `chroma`, `blur`, plus `spec`
  on the morph surface and the ripple. Both READMEs and the skill say so.

- [#6](https://github.com/Amir-Abushanab/liquid-glass-js/pull/6) [`b5d37e9`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/b5d37e98762be8be812a4fb21f517bd49d4d682e) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Line the glyph map up with a target that has padding. Everything else about the map is
  measured against the border box and the glyphs are not — they start at the content box
  — so a padded glass heading had its whole map drawn one padding-left to the left of the
  letters it was meant to be shaped like, and the glass slid off them.

  Padding on the target is not exotic: it is the ordinary way to stop `background-clip:
text` cutting the descenders off gradient-filled letterforms. Two places had to learn
  about it.

  `buildGlyphDisplacementMap` now draws at `margin + padLeft`, and measures ink overflow
  from the text origin rather than the box origin.

  `fontScale` — which compares the DOM's laid-out run against what the canvas makes of
  the same font, to recover the used size where `font-size-adjust` is in play — measured
  its clone's border box. With padding that is wider than the text, so the ratio came out
  inflated and the map was rasterized oversized on top of being mispositioned. The clone
  now zeroes padding and border along with letter-spacing, since what it wants is the
  width of the glyphs and nothing else. On the same three faces the ratio goes back to
  0.989 / 1.094 / 1.440, its values before any padding existed.

- [#6](https://github.com/Amir-Abushanab/liquid-glass-js/pull/6) [`fa9e38c`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/fa9e38ca64512dc523c3ee9b02b3e893ec79c4bc) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Fix every SVG glass renderer in Safari.

  Three separate WebKit behaviours, each measured against Chromium and Firefox, each
  of which silently broke glass in a different way.

  **1. `userSpaceOnUse` coordinates resolve against the page origin.** WebKit resolves
  both the filter region and any primitive subregion against the document origin
  rather than the filtered element's own, unless that element establishes a
  coordinate system. Measured on a 200×200 element at page (50,50), with a region at
  `x=0 y=0` and an `feImage` subregion at `x=60 y=60`:

  |          | subregion lands | region lands |
  | -------- | --------------- | ------------ |
  | webkit   | 60,60           | 0,0          |
  | firefox  | 110,110         | 50,50        |
  | chromium | 110,110         | 50,50        |

  So each map went wherever the element sat in the document — further down the page,
  further off. That one fact accounts for the lens appearing to split into a stuck
  layer and a moving one, glass text and glass marks rendering as blank space (their
  chain ends in `operator="in"` against `SourceAlpha`, so a map that landed elsewhere
  clipped the result to nothing), and controls losing their backdrop while pressed.

  Any transform-family property normalises it in every engine; `perspective` does
  not, which is what identifies this as a coordinate-system question. `applyGlassFilter`
  sets the `rotate` longhand — never clobbering a `transform` the page owns — and only
  in WebKit, since Chromium and Gecko resolve the origin correctly on their own and the
  pin is not free: a transform makes an element the containing block for its own
  `background-attachment: fixed`, which detaches a fixed backdrop from the viewport and
  squeezes it into the element box. That is exactly the shape of the panes that clone
  the page backdrop, so those are not pinned at all. They get the same correction
  arithmetically instead — `glassOriginOffset()` adds the element's document position
  to the filter's coordinates, WebKit's own frame of reference, which needs no scroll
  tracking because the map scrolls with the page. Both the alpha chain (glass text and
  marks) and the morph chain take it; the lens has no fixed backdrop, so it keeps the
  cheaper pin.

  **2. Filter output is cached by id.** Mutating a primitive's attributes under an
  unchanged id leaves Safari painting the result it cached when that id was created,
  so the per-frame paths froze: the lens stuck where it mounted, the ripple never
  advanced past its pre-first-frame state (reading as no ripple at all), and a morph
  surface wouldn't follow a drag. `refreshGlassFilter` renames the filter and
  re-points the element, which is the only invalidation that works — measured live in
  Safari, re-inserting the node and nudging the element both do nothing. Gated to
  WebKit: renaming every frame measurably worsens the frame-time tail elsewhere
  (firefox p90 8.9ms → 58.8ms, chromium 9.2ms → 16.6ms), and both re-run the filter
  on an attribute change anyway. Callers skip frames where nothing actually moved.

  **3. On an inline `<svg>`, every filter coordinate is read in viewBox units.**
  Region and primitives alike, where the other engines use CSS px. On a 64-unit
  viewBox drawn at 200px (3.125×): an `feImage` subregion at `x=20 y=20 100×100`
  landed at 112,112 sized 138, and `feOffset dx=20` — a pure length — shifted 63px
  instead of 20. Glass marks got their map drawn oversized and offset, losing the rim
  glint and showing a dark misplaced crescent, with displacement and blur inflated to
  match. `primitiveScale()` multiplies by `viewBoxWidth / cssWidth` to cancel it,
  returning 1 for HTML targets, for an `<svg>` without a viewBox, and for a viewBox
  already in CSS px.

  Also: **`blur` now renders the same in all three engines**, which it never did. Every
  displacement chain goes through one rule — all seven of them, where before only the
  lens normalised anything at all.

  Reading the sigma each engine actually applies off the rendered pixels (a Gaussian
  smears a hard edge over a 10%-90% rise of 2.563 sigma), sampled every 0.1:

  | stdDeviation | chromium | webkit | firefox     |
  | ------------ | -------- | ------ | ----------- |
  | 0            | 0        | 0      | 0           |
  | 0.1 – 0.7    | 0        | 1.47   | 0 → 0.76    |
  | 0.8 – 1.3    | 1.07     | 1.47   | 0.85 → 1.28 |
  | 1.4 – 1.8    | 1.47     | 1.47   | 1.42 → 1.79 |
  | 1.9 – 2.3    | 2.20     | 2.51   | 1.86 → 2.20 |
  | 2.4 – 2.9    | 2.51     | 2.51   | 2.51        |
  | 3.0 – 3.4    | 3.21     | 3.53   | 3.21        |
  | 3.5 – 3.9    | 3.53     | 3.53   | 3.53        |

  Nobody applies a Gaussian. The spec says to approximate one with three box blurs of
  size `d = floor(s * 3 * sqrt(2*PI) / 4 + 0.5)`, and those plateaus are that
  quantisation — every transition lands on an integer step of `d`, and the deliverable
  sigma is `sqrt(d² - 1) / 2` and nothing between. What differs is which `d` each engine
  will produce: **Chromium** any of them (`d <= 1` renders as nothing), **WebKit** odd
  `d` only and never below 3 — which is why every value from 0.1 to 1.8 gives the
  identical 1.47 there, and why Safari simply cannot blur by less than ~1.4px —
  **Gecko** a real Gaussian below `d = 4`, box-quantised above it.

  So the set all three can hit is WebKit's: 0, 1.414, 2.449, 3.464, 4.472, … The
  requested blur is snapped to the nearest of those rungs and a `stdDeviation` emitted
  that lands every engine on it. Verified by re-measuring: eighteen requested values
  from 0 to 8, all three engines identical on every row (worst spread 0.03, inside the
  measurement noise).

  The cost is explicit. The rungs are ~1px apart, so `blur: 1` renders as 1.41
  everywhere instead of 1.07 / 1.47 / 0.99 — there is no `stdDeviation` that makes
  Safari blur by 1.0, so agreeing means moving to a value it can reach. Below 0.71 the
  nearest rung is 0, which is where the old sub-pixel threshold went; it now falls out
  of the same rule rather than being a separate cutoff.

  That also fixes the colour half of it, which is how this was first found — WebKit
  desaturates a partially transparent source the moment the blur is non-zero, same
  plateaus, same edges, a premultiply round-trip rather than physics:

  | stdDeviation | 0     | 0.2   | 0.35  | 0.5   | 0.75  | 1     | 2    |
  | ------------ | ----- | ----- | ----- | ----- | ----- | ----- | ---- |
  | webkit       | 124.1 | 95.9  | 95.9  | 95.9  | 95.9  | 95.9  | 82.3 |
  | firefox      | 123.6 | 123.6 | 122.7 | 117.4 | 109.6 | 104.2 | 85.9 |
  | chromium     | 123.8 | 123.8 | 123.8 | 123.8 | 123.8 | 102.7 | 86.0 |

  A 0.4px blur nobody asked to see cost the emoji orb a quarter of its colour.

  `preBlurStd()` zeroes the value rather than removing the primitive: measured through a
  real chain, "no `feGaussianBlur` at all" and "`feGaussianBlur stdDeviation=0`" are
  identical in every engine, so keeping it gives the chain one shape and lets a live
  blur change stay a single `setAttribute`. It lives in `blur-quantize.ts` with the
  measurements, and is exported — anyone hand-rolling a chain needs the same rule.

  Also clips the WebGL canvas to the glass radius itself. The wrapper's overflow and
  border-radius are enough for ordinary content, but a WebGL canvas is its own
  compositing layer and Firefox does not clip a composited layer to an ancestor's
  ROUNDED corners — only to its box — so it kept square corners overhanging the rim.

  Unaffected and unchanged: `mountSvg` and `mountDomRefract` carry no subregion and
  size their region in bbox units — which is why dom-refract was the one renderer
  that already worked in Safari — and the `url()` frost path is Chromium-gated.

  Both READMEs gain a **Gotchas** section — plain bullets, grouped by browser — for the
  things the library can't fix from inside and for what it took to find them: Safari's
  page-origin filter coordinates and the transform that fixes them (and the
  fixed-attachment backdrop that transform breaks), its id-keyed filter cache, its
  viewBox-unit coordinates on inline `<svg>`, composited layers being skipped by an
  ancestor's filter and the two things that promote one, the canvas gradient that greys
  out colour emoji; Firefox's square WebGL corners inside a rounded box and its washed
  out `repeating-linear-gradient` hairlines; the box-quantised blur, `background-clip:
text` refusing to paint the parts of a glyph that reach outside the padding box (so
  gradient-filled letterforms lose their descenders and it looks like the filter did it),
  the filter bending rather than scaling, needing bleed outside the target, the
  ink-vs-border bbox in `objectBoundingBox` units, `feImage` needing an explicit
  subregion, canvas and video re-filtering every frame, `backdrop-filter: url()` parsing
  everywhere and painting only in Chromium; and how to test any of it — not from a Safari
  screenshot, not in any WebKit that isn't Safari (Playwright's lacks the cache and the
  compositing rules, an embedded one in a dev tool can invent bugs Safari doesn't have),
  and never against something that's animating.

  Ships a [TanStack Intent](https://github.com/TanStack/intent) skill at
  `packages/core/skills/liquid-glass/SKILL.md` (included in the published package), so
  an agent picking up the library gets the component-selection guidance and these
  pitfalls without rediscovering them.

- [#6](https://github.com/Amir-Abushanab/liquid-glass-js/pull/6) [`e10949b`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/e10949b13f93e97c036f6283e43ae26001f2f47a) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Hold the alpha map's rim to a fraction of the artwork's own stroke width, so one set
  of params works across font families, weights and sizes.

  `bevel` is the sigma of the coverage blur, in px — but a stroke's width is not a fixed
  number. The same 1.3px rim that reads as a highlight down a 24px display stem swallows
  a 3px one whole, and a stroke with no flat core left is all rim: every pixel is a
  gradient, the glint and the sheen never resolve into an edge, and the letterform goes
  pale and illegible. That is what made a bevel that looked right in one face look wrong
  in the next.

  Mean stroke width falls out of the coverage for free — for a stroke-like shape
  area ≈ width × length and total variation ≈ perimeter ≈ 2 × length, so
  `width ≈ 2·area/TV`, one extra pass over a buffer the builder already fills. The rim
  sigma is then held between `stroke/8` and `stroke/3`: blurring a stem of width W by
  W/3 leaves its centre at erf(3/(2√2)) ≈ 0.86, still a distinct interior for the dome
  to swell and the glint to run around, while W/8 still reads as an edge rather than a
  hairline. Between those bounds `bevel` is honoured exactly, so artwork already in
  proportion is untouched. The upper bound also can't outrun the raster margin, which
  was sized for 3·bevel.

  Measured over 32 combinations — Helvetica 300/400/700/900, Georgia 400/700,
  ui-monospace 400/700, each at 18/32/64/120px — the ratio the map actually depends on:

  | sigma / stroke width | mean | sd   | range         | spread |
  | -------------------- | ---- | ---- | ------------- | ------ |
  | before               | 0.38 | 0.25 | 0.096 – 1.049 | 10.9×  |
  | after                | 0.26 | 0.08 | 0.125 – 0.333 | 2.7×   |

  At the bad end the blur was wider than the letter it was supposed to edge (1.049× the
  stroke); at the other it was a 0.096× hairline. The share of ink pixels carrying a
  resolved glint band tightens with it, from a 2.4× spread to 1.4×.

  Every other map parameter — `dome`, `edge`, `glow`, `shade` — is already scale-free:
  they multiply gradient bands whose magnitude is normalised by sigma, so they were
  never the problem. `bevel` was the only absolute length in the map, and with it
  proportional the whole set travels between faces.

  Applies to `mountGlassShape` too, since both share the builder. Solid artwork measures
  a stroke width far wider than any sensible rim, so the bounds don't bite; thin line-art
  marks get the same protection text does.

  `strength` remains an absolute px displacement by design — it is how far pixels move,
  not how the map is shaped — so a value much larger than the rim will still read
  differently at different sizes.

- [`ae9c031`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/ae9c0315c4608f76c3ea72894d5aeaebeaaee21f) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Fix the frost fallback never engaging on Safari and Firefox.

  `mountGlass`'s frost path has always had two branches: Chromium gets a refractive
  frost (the same `feDisplacementMap` run over the live page behind the surface),
  and everything else gets a plain `blur()`. The gate that chose between them was
  `CSS.supports('backdrop-filter', 'url("#a")')` — and that check can't gate
  anything, because it only _parses_. Safari and Firefox both accept `url()` in the
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

- [#6](https://github.com/Amir-Abushanab/liquid-glass-js/pull/6) [`088f2b4`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/088f2b414e6d8f484cd5e417d4f8543c1bcfe139) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Don't let an explicitly-undefined option shadow its default. Fixes the glass root
  carrying `--g-tint: undefined` (so no tint layer painted), the frosted fallback
  computing `blur(NaNpx)` and painting no blur at all outside Chromium, and `blur`,
  `spec` and `vibrancy` silently resolving to nothing whenever a caller left them out.

  `mountGlass` merged with `{ ...GLASS_DEFAULTS, ...opts }`. Every binding forwards the
  whole option list — the React one destructures all seventeen props and passes each by
  name — so a prop the caller simply didn't set arrives as an explicit `tint: undefined`
  key, and a plain spread lets it win. Only options the caller passed are merged now,
  which is the same guard `mountGlassShape`, `mountGlassText` and `mountGlassLoupe`
  already applied to theirs.

  Surfaces that relied on the accidental behaviour will look different, because they were
  running without the defaults they asked for: a frosted panel that never passed `blur`
  was refracting a sharp backdrop and now diffuses it, which is what `blur: 2` means.
  Pass `blur={0}` to keep the old look.

- [#8](https://github.com/Amir-Abushanab/liquid-glass-js/pull/8) [`0fd6536`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/0fd6536f9b3507ce38ee8b8a9ee7cc62226fa171) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Round the WebGL canvas in Firefox for real.

  Gecko's compositor ships a live canvas's layer square: the wrapper's rounded
  overflow, `border-radius` on the canvas, and even `clip-path` on the canvas
  are all skipped (verified windowed on Firefox 154 with a variant bench;
  headless/software WebRender renders every variant correctly, which is why the
  first two fixes looked plausible and weren't). The canvas now carries
  `clip-path: inset(0 round var(--g-radius))` plus — Gecko-gated on
  `-moz-element` support, since elsewhere it would only tax direct compositing —
  a visually-no-op fully-opaque `mask-image: linear-gradient(#000 0 0)` that
  forces the element off the compositor fast path, where the clip finally
  applies. Corners verified clean in windowed Firefox on the production mount.

- [#7](https://github.com/Amir-Abushanab/liquid-glass-js/pull/7) [`d7f48d6`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/d7f48d6289308f05bfdb894ecbff396e2d76b691) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Four WebKit hardenings, three of them found by an embedded browser wearing a
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

## 0.4.0

## 0.3.0

## 0.2.0

### Patch Changes

- [`20eb1b6`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/20eb1b6f03d1729d935f851098d8a724e1adfe54) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Fix Glass QR failure modes, and theme the frosted fallback from `--glass-paper`.

  **qr — a failed mount no longer strands DOM.** `mountGlassQR` appended its
  elements to the container _before_ constructing the WebGL2 renderer, so a
  browser without WebGL2 (Brave's fingerprinting shields, among others) got an
  exception plus an empty `.ps-qr` left behind. Every fallible step of the mount
  now unwinds its own DOM before rethrowing, which also covers the failures that
  ordering alone wouldn't — a shader compile or link error, or a 2D context the
  browser refuses.

  **qr — `isGlassQRSupported()`.** A cached WebGL2 probe, so consumers can decide
  whether to enhance at all instead of writing their own. It releases its probe
  context (browsers cap live contexts) and returns `false` on the server without
  caching, so the client re-probes after hydration. The degenerate
  "geometry produced nothing" path now throws like the others rather than
  returning a no-op handle over an empty box.

  **qr — `nonce` and `styles` options.** The mount injects a `<style>` into
  `document.head`, which a strict `style-src` CSP drops. Pass `nonce`, or import
  the new `@liquidglassjs/qr/css` entry and mount with `styles: false`. The
  built-in centre mark is now built with `createElementNS` instead of `innerHTML`,
  so it also survives `require-trusted-types-for 'script'` — and its gradient ids
  are per-instance, fixing two QRs on one page shadowing each other's `<defs>`.

  **qr — `handle.dispose()`.** The handle stays callable, but now also carries a
  named `dispose()`, matching `mountGlass`'s `GlassInstance` in core. Repeat
  disposal is a no-op.

  **core — `--glass-frost-bg` derives from `--glass-paper`.** It defaulted to a
  hardcoded `rgb(255 255 255 / 55%)`, so the frosted fallback — the path most
  consumers land on — rendered as a light slab on dark themes even after setting
  `--glass-paper`. Now `color-mix(in srgb, var(--glass-paper, #fff) 55%, transparent)`,
  matching what `glass.css` already did for the tint.

## 0.1.1

### Patch Changes

- [`5568632`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/55686326ab2ccac64b7d17a7da890a9490ce4559) Thanks [@Amir-Abushanab](https://github.com/Amir-Abushanab)! - Astro + interactivity fixes from first-consumer feedback:

  - Add the `astro-component` / `withastro` keywords so Astro auto-adds the package to `vite.ssr.noExternal` — importing the raw `.astro` adapters no longer dies in Vite SSR without a manual noExternal.
  - The Astro adapter now writes `data-tint`, so an authored `tint` survives `mountGlassFromData` instead of being reset to the default at mount.
  - `.ps-glass__content` is pointer-transparent only when a `.ps-glass__refract` layer sits beneath it (clicks must reach the live DOM being bent). On frost/backdrop surfaces the slotted content is the interactive surface, so nav links and buttons inside the glass now work without a consumer `pointer-events` override.
