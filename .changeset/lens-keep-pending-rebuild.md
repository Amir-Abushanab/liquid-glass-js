---
'@liquidglassjs/core': patch
---

Lens: a move or scale change no longer drops a map that is still decoding

`mountGlassLens` (and `mountGlassMorph`) defer swapping in a rebuilt map until
its bitmap has decoded, and drop the pending swap if a newer rebuild has
superseded it. That check compared against the filter-id counter — which
`setPos` and `setDisplScale` also bump, in every engine, for their Safari
re-point. So any per-frame move or scale write that landed inside the decode
window made the new map look superseded, and it was silently dropped. The
lens's own size had already been updated, so the next `setSize` to that size
was a no-op: the filter stayed at the old size until something asked for a
third one.

On a segmented control that calls `setSize` once per switch and `setPos` +
`setDisplScale` on every frame of the slide, that was a specular rim of the
previous option's width painted beside the pill — the control "splitting into
two layers" after a quick run of clicks. Reproduced on Chromium at 2 of 10
quick switches unthrottled and 6 of 10 under 4× CPU throttling; 0 of 40 after.

Rebuilds now carry their own generation counter, and the fresh filter id is
minted when the map is actually applied.
