---
'@liquidglassjs/core': minor
---

Retune `GLASS_TEXT_DEFAULTS`. Glass letterforms now default to a domed, bevelled
treatment rather than a refracting one — the displacement is turned almost all the way
down and the shaping is turned up.

| param      | was  | now |
| ---------- | ---- | --- |
| `strength` | 8    | 0.5 |
| `chroma`   | 0.4  | 1   |
| `blur`     | 0.3  | 1.2 |
| `bevel`    | 2.5  | 1.3 |
| `dome`     | 4    | 12  |
| `edge`     | 0.9  | 1.5 |
| `glow`     | 0.35 | 1   |
| `shade`    | 0    | 1   |

At display sizes a strong displacement fights the letterform — the counters distort
and the type stops reading as type. Dome, edge, glow and shade shape the glyph as a
solid piece of glass instead, which holds up better the larger it gets. Pass explicit
params to `mountGlassText` for the old look.

`GLASS_SHAPE_DEFAULTS` is unchanged. Logos and marks are arbitrary artwork rather than
letterforms, and they still want the refraction.
