---
'@liquidglassjs/core': minor
'@liquidglassjs/element': minor
'@liquidglassjs/react': minor
---

Add the glass loupe — the iOS "hold on a word" magnifier.

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
