---
'@liquidglassjs/core': patch
---

Frost: keep the outline, at the same brightness, while the box is resizing, and stop building a lens on the first frame of a resize

While a frosted surface resizes, frost swaps its refraction for the plain blur
(the raster is the whole cost of a resize animation). The lens took its specular
rim with it, and that light edge is what reads as the glass's outline: a menu
opening inside a glass navbar looked like it lost its border for the length of
the animation, then had it snap back.

The root now carries `data-glass-motion` while the blur stands in, and the tint
layer redraws the lens's own rim for exactly that window. It isn't a generic light
ring, since the lens's rim is directional and soft: a glow about 14px deep at the
lit corners, next to nothing at the other two. A ring there left the outline
brighter at both ends of the animation than in the middle. The new `frost-glint`
module turns the map's specular channel into inset shadows under a mask along
the light axis, and weighs it by the light the frost wash and tint let through
and the headroom the paper leaves. Measured against the lens on a glass navbar,
it matches the rim's light within about 5% on a dark theme and follows the
clipped haze on a light one. It switches in the same frame the lens drops out
and the frame it returns, so the handoff neither stacks two rims nor shows none,
and frame times are unchanged at 4× CPU throttle.

Every resize now degrades straight away and rebuilds once the size has held for
120ms. Before, the first frame of a run built a full lens that the next frame
threw away, which dropped a frame at the very start of a menu opening (33ms at
4× CPU throttle on a Pixel 7; a steady 17ms now). A surface that has never had
a lens (sized 0 at mount) still builds the moment it first gets a box.
