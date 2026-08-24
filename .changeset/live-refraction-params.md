---
'@liquidglassjs/core': patch
---

Give `mountGlassLens` and the morph surface the attribute-only `reconfigure` path
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
