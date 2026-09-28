---
'@liquidglassjs/core': patch
---

Build displacement maps on CPU-backed canvases

Every map is written with `putImageData` and read back once by `toDataURL`. On
Chromium's default GPU-backed 2D canvas that read-back is a synchronous round trip
to the GPU process, so each encode stalled for ~11ms whatever the map's size (a map a
quarter the size encoded no faster). The single-surface and group generators now ask
for `willReadFrequently`, as the glyph map already did, and the same encode takes
1.4ms at 300k px.

Nothing renders differently. The maps are byte-identical, and every registry
component page screenshots pixel-identical before and after, dialog and dropdown
open included. Measured in Chromium, encodes got cheaper everywhere a map rebuilds:
Glass Card 4.45ms → 0.55ms (worst 14.6 → 0.7), Glass Surface 3.95 → 0.48, Glass
Group 1.76 → 0.44 (worst 11.0 → 0.6), Glass Lens 2.24 → 0.87. A group drifting on a
570×520 pane at ~20 rebuilds a second went from 20–23 frames over 25ms per 5s to 1–3.
