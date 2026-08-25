---
'@liquidglassjs/core': minor
---

Merged-glass silhouette tooling for panes that span several shapes (the droplet-menu pattern), so the pane only paints where the fused glass actually is — no CSS shape can express the smin neck, only the SDF that made it:

- `buildGroupSilhouette` / `renderGroupSilhouette`: the union's alpha raster, for CSS `mask-image` on a static pane.
- `traceGroupSilhouette`: the same zero isoline as an SVG path string, for `clip-path: path(...)` — commits synchronously with the styles that move the shapes, which is what keeps a per-frame morph tear-free where a mask data URL (async decode) cannot.
- `GlassGroup.flush()`: run the group's re-measure + map re-encode now, in the caller's frame, instead of one rAF behind — for driven morphs that must keep map, clip, and content in lockstep.
- `smoothNormals` (group map + mountGlassGroup option, default 0/off): blur only the field the displacement DIRECTION reads, so the crease an exact SDF's medial axis folds into every corner becomes a gentle swirl — magnitude and coverage keep the exact field, so the rim stays crisp.
