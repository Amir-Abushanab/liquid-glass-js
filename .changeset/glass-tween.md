---
'@liquidglassjs/core': minor
---

Add `glassTween` — ease a refraction param from one value to another, for hover,
press, focus, or anything else with two states.

```js
const glass = mountGlassText({ target: h1, host: h1, strength: 4 });
const tween = glassTween(glass, { duration: 320 });
h1.addEventListener('pointerenter', () => tween.to({ strength: 12.5 }));
h1.addEventListener('pointerleave', () => tween.to({ strength: 4 }));
```

Works on any renderer — text, shape, lens, morph surface — since they all carry the
same `reconfigure`/`getOptions` pair. Calling `to()` mid-flight retargets from the
current value rather than snapping back to the start, so hovering in and out faster
than the duration stays continuous. `prefers-reduced-motion: reduce` jumps to the
target, read per call so toggling the OS setting needs no reload.

It is deliberately not a preset library. `duration` and `easing` are the app's;
`cubicBezier` is exported if you want the soft overshoot the built-in controls use.
What it does carry is the one thing the library knows and the caller can't see: which
params are safe to write every frame. `strength`, `chroma`, `blur` and `spec` set a
filter attribute (~0.01ms); everything else is an input to the displacement map and
re-encodes a PNG (~1.8ms on a lens). So the tween eases the first group and applies the
second once, up front — the shape snaps and the refraction eases into it, which is the
right way round anyway: a bevel morphing mid-hover reads as a glitch, a deepening bend
reads as glass.
