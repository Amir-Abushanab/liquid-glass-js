---
'@liquidglassjs/core': patch
---

`glassTween` accepts every renderer in TypeScript without a cast. `GlassTweenTarget.getOptions()` was typed `Record<string, number>`, which no renderer's params interface matched, so `glassTween(mountGlassText(...))` failed to type-check; it is now `object`. Runtime behaviour is unchanged.
