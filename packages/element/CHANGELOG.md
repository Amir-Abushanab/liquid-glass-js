# @liquidglassjs/element

## 0.5.1

### Patch Changes

- Updated dependencies [[`000dd35`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/000dd35ca534be24279cff09df4c1b9f6b9a214b)]:
  - @liquidglassjs/core@0.5.1

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

- Updated dependencies [[`98b1460`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/98b1460f8b950bd080c43229e1ee54c4cdc9b24e), [`893eab7`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/893eab79d8533926d781ab46f999ef684869c2ac), [`3ab6fed`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/3ab6fed930384626ae87270d24a528c7104a21da), [`78aff49`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/78aff497958559119ae86e82402e1cb0615b5bb6), [`f9d2128`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/f9d212824796c7bb52c854f272406ab8bb3f1951), [`5bba5ff`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/5bba5ffc7283b8bb02618d5822fff76a5322b6f4), [`fbb347a`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/fbb347a39f7b1fcce277c6621e77893449f71061), [`bfef218`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/bfef21809b6628060cef4188c1e7abb50f24b36e), [`d7f48d6`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/d7f48d6289308f05bfdb894ecbff396e2d76b691), [`12937f5`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/12937f51a6b7c6ed31be4628490940f3bc716563), [`d7f48d6`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/d7f48d6289308f05bfdb894ecbff396e2d76b691), [`52b7bfe`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/52b7bfe424540a36b1a2482712b4812397394148), [`b5d37e9`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/b5d37e98762be8be812a4fb21f517bd49d4d682e), [`d7f48d6`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/d7f48d6289308f05bfdb894ecbff396e2d76b691), [`d7f48d6`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/d7f48d6289308f05bfdb894ecbff396e2d76b691), [`fa9e38c`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/fa9e38ca64512dc523c3ee9b02b3e893ec79c4bc), [`e10949b`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/e10949b13f93e97c036f6283e43ae26001f2f47a), [`d7f48d6`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/d7f48d6289308f05bfdb894ecbff396e2d76b691), [`ae9c031`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/ae9c0315c4608f76c3ea72894d5aeaebeaaee21f), [`088f2b4`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/088f2b414e6d8f484cd5e417d4f8543c1bcfe139), [`0fd6536`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/0fd6536f9b3507ce38ee8b8a9ee7cc62226fa171), [`d7f48d6`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/d7f48d6289308f05bfdb894ecbff396e2d76b691)]:
  - @liquidglassjs/core@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies []:
  - @liquidglassjs/core@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies []:
  - @liquidglassjs/core@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [[`20eb1b6`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/20eb1b6f03d1729d935f851098d8a724e1adfe54)]:
  - @liquidglassjs/core@0.2.0

## 0.1.1

### Patch Changes

- Updated dependencies [[`5568632`](https://github.com/Amir-Abushanab/liquid-glass-js/commit/55686326ab2ccac64b7d17a7da890a9490ce4559)]:
  - @liquidglassjs/core@0.1.1
