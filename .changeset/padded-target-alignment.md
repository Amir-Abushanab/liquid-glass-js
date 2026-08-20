---
'@liquidglassjs/core': patch
---

Line the glyph map up with a target that has padding. Everything else about the map is
measured against the border box and the glyphs are not — they start at the content box
— so a padded glass heading had its whole map drawn one padding-left to the left of the
letters it was meant to be shaped like, and the glass slid off them.

Padding on the target is not exotic: it is the ordinary way to stop `background-clip:
text` cutting the descenders off gradient-filled letterforms. Two places had to learn
about it.

`buildGlyphDisplacementMap` now draws at `margin + padLeft`, and measures ink overflow
from the text origin rather than the box origin.

`fontScale` — which compares the DOM's laid-out run against what the canvas makes of
the same font, to recover the used size where `font-size-adjust` is in play — measured
its clone's border box. With padding that is wider than the text, so the ratio came out
inflated and the map was rasterized oversized on top of being mispositioned. The clone
now zeroes padding and border along with letter-spacing, since what it wants is the
width of the glyphs and nothing else. On the same three faces the ratio goes back to
0.989 / 1.094 / 1.440, its values before any padding existed.
