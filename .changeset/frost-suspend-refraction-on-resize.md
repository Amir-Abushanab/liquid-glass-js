---
'@liquidglassjs/core': patch
---

Frost: suspend refraction while the box is resizing

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
