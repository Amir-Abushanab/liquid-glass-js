---
'@liquidglassjs/core': minor
---

`mountGlassGroup` takes `mapScale`, to build a smaller map

A group rebuilds its whole map on every move, so items that drift every frame pay
for it every frame. `mapScale` (default 1, clamped 0.25–1, set at mount) builds the
map at that many pixels per CSS pixel and lets the feImage stretch it back. The
geometry, blend, depth and specular band scale with it, so the rim keeps its width.
With the group drifting on a 570×520 pane, the page's main thread went from 35% busy
to 25% at 0.75 and about 21% at 0.5; with the CPU throttled 4×, 78% to 60% and about
57%.

The rim pays for it. The offsets are interpolated across the silhouette, so at 0.5 a
faint second edge shows along it and grid-like content hooks where it crosses it;
0.75 is milder. The default is unchanged.
