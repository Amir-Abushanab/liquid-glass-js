---
'@liquidglassjs/core': patch
---

Size every glass from its own layout box, so a transform above it can't bake a wrong map

A displacement map is drawn in the filtered element's own coordinates, but
`mountGlassGroup`, `mountGlassShape`, `mountGlassText`, `mountGlassButton`,
`mountGlassDropdown`'s menu and the SVG ripple measured it with
`getBoundingClientRect()`, which includes every transform above the element.
Mounted inside a panel scaling in from 0.95 (a dialog, a menu, a popover) or
a card being revealed at a tilt, each baked its map a few percent small. The
transform then settles without the layout box changing, so no
ResizeObserver fired and the map was never rebuilt: the rim stayed traced
inside the glass it belongs to.

They now size from the layout box, as the root `mountGlass` already did, and
convert what they must still read off rects (a group item mid-slide, a
text's baseline, a label's width) back into the element's own pixels.
Measured inside a `scale(0.9)` container, every one of them now bakes the
same map as the same glass unscaled; before, each came out at 90%.
