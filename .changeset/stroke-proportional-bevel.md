---
'@liquidglassjs/core': patch
---

Hold the alpha map's rim to a fraction of the artwork's own stroke width, so one set
of params works across font families, weights and sizes.

`bevel` is the sigma of the coverage blur, in px — but a stroke's width is not a fixed
number. The same 1.3px rim that reads as a highlight down a 24px display stem swallows
a 3px one whole, and a stroke with no flat core left is all rim: every pixel is a
gradient, the glint and the sheen never resolve into an edge, and the letterform goes
pale and illegible. That is what made a bevel that looked right in one face look wrong
in the next.

Mean stroke width falls out of the coverage for free — for a stroke-like shape
area ≈ width × length and total variation ≈ perimeter ≈ 2 × length, so
`width ≈ 2·area/TV`, one extra pass over a buffer the builder already fills. The rim
sigma is then held between `stroke/8` and `stroke/3`: blurring a stem of width W by
W/3 leaves its centre at erf(3/(2√2)) ≈ 0.86, still a distinct interior for the dome
to swell and the glint to run around, while W/8 still reads as an edge rather than a
hairline. Between those bounds `bevel` is honoured exactly, so artwork already in
proportion is untouched. The upper bound also can't outrun the raster margin, which
was sized for 3·bevel.

Measured over 32 combinations — Helvetica 300/400/700/900, Georgia 400/700,
ui-monospace 400/700, each at 18/32/64/120px — the ratio the map actually depends on:

| sigma / stroke width | mean | sd   | range         | spread |
| -------------------- | ---- | ---- | ------------- | ------ |
| before               | 0.38 | 0.25 | 0.096 – 1.049 | 10.9×  |
| after                | 0.26 | 0.08 | 0.125 – 0.333 | 2.7×   |

At the bad end the blur was wider than the letter it was supposed to edge (1.049× the
stroke); at the other it was a 0.096× hairline. The share of ink pixels carrying a
resolved glint band tightens with it, from a 2.4× spread to 1.4×.

Every other map parameter — `dome`, `edge`, `glow`, `shade` — is already scale-free:
they multiply gradient bands whose magnitude is normalised by sigma, so they were
never the problem. `bevel` was the only absolute length in the map, and with it
proportional the whole set travels between faces.

Applies to `mountGlassShape` too, since both share the builder. Solid artwork measures
a stroke width far wider than any sensible rim, so the bounds don't bite; thin line-art
marks get the same protection text does.

`strength` remains an absolute px displacement by design — it is how far pixels move,
not how the map is shaped — so a value much larger than the rim will still read
differently at different sizes.
