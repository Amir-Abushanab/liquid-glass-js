---
'@liquidglassjs/core': patch
---

Preserve transparency when SVG glass filters recombine their displaced RGB channels. Antialiased icons, text and translucent content retain their original edge coverage at zero displacement, while chromatic fringes keep their displaced coverage during refraction.
