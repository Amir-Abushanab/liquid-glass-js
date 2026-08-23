---
'@liquidglassjs/core': minor
---

Merged glass: `mountGlassGroup` gives several elements ONE displacement map
whose rounded-rect SDFs fuse by smooth-min — Apple's droplet merge
(GlassEffectContainer's spacing), in pure SVG. Bring one item within about
`blend / 2` px of another and their rims flow together through a neck,
refraction and glint following the fused silhouette; the CSS "gooey" trick
merges only the alpha silhouette, and nothing else in the field fuses the
refraction fields themselves.

The generator (`renderGroupDisplacementMap`, exported) evaluates the merged
SDF into per-cluster field patches (far-apart shapes cost two small patches,
not one rect spanning the gap), takes displacement direction from the field's
gradient so the normal rotates smoothly through the neck, feathers the
silhouette by one pixel of SDF coverage (the antialias a supersampled
downscale would produce, at 1× cost), and supports both rim profiles. Groups
are bevel-only — a union has no centre to dome from — and carry their own
`shade` (dark occlusion rim baked into the map, the stand-in for per-element
inset-shadow chrome, which would draw straight through a merged neck) and
`blend`.

Items are chrome above the refracted pane, never filtered themselves, so
sliding one with a transform is safe under Safari's composited-child rule;
they are measured transforms-included, and `update()` is rAF-coalesced and
keyed at half-pixel so unmoved frames cost nothing.

`specularRotation` (light angle, degrees) also becomes a live-tunable param on
the lens, loupe and group — a map key, documented to be driven quantized when
tied to pointer bearing or device tilt; the light-follows-the-world idea is
clayharmon's webgl-liquid-glass.
