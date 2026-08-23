---
'@liquidglassjs/core': minor
'@liquidglassjs/react': minor
---

The glass can energize under the pointer.

- `GlassLens.setDisplScale(frac)`: a cheap per-frame multiplier on the three
  displacement scales — attribute writes plus the Safari id re-point, never a
  map rebuild.
- `createSpring(initial, onUpdate, {stiffness, damping})`: a scalar
  semi-implicit-Euler spring with the timestep clamped to 20ms substeps (one
  slow frame integrated whole diverges — spring force grows with distance) and
  a rAF loop that sleeps at settle. `set()` honours
  `prefers-reduced-motion` by snapping; `snap()` is the explicit no-animation
  path. Exported alongside `prefersReducedMotion()`.
- React `<GlassLens press={1.25}>`: the boost springs in while the pointer is
  held and out on release. Default 1 keeps existing lenses pixel-identical.

The spring-into-the-displacement-scale idea is ZeroxyDev's liquid-glass-js
`refractionBoost`; the substep clamp is a lesson from clayharmon's
webgl-liquid-glass.
