---
'@liquidglassjs/core': patch
---

Rasterize glass text at the size the browser actually drew it, not the size CSS
reports. Fixes the map sliding out from under the letters — worse the further along
the line you look — on any page that sets `font-size-adjust`.

A canvas 2D context understands `font-style font-weight font-size font-family` and
nothing else. CSS has properties that change the *used* glyph size without changing
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
it never asks *why* the two disagree.
