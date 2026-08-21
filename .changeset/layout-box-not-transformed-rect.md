---
'@liquidglassjs/core': patch
---

Size the displacement map from the element's layout box rather than its transformed
rect. Fixes glass mounted inside a panel that animates in from a scale — a dialog, a
menu, a popover — baking a map at the animation's start size and keeping it, so the
rim traces a rounded rectangle a few px inside the panel it belongs to.

All three render paths measured with `getBoundingClientRect()`, which reports the
*transformed* box. A popup entering from `scale(.95)` is at 95% for the frame the glass
mounts on, so a 512x218 panel produced a 486x207 map. The transform then settles at
100% without touching the layout box, so no `ResizeObserver` fires and nothing rebuilds
it. Stretched back across the full element, the map's rim and dome land inset from the
real edge and the surface reads as two rounded rectangles that don't line up.

`offsetWidth`/`offsetHeight` are the layout box and are immune to transforms, which is
exactly the invariant wanted here: the map depends on the element's shape, not on where
a compositor happens to be drawing it this frame. Inline and SVG hosts have no offset
box, so those fall back to the rect as before.
