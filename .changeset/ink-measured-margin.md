---
'@liquidglassjs/core': patch
---

Size the glyph map's margin from the measured ink instead of a flat `0.2em`, so faces
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
