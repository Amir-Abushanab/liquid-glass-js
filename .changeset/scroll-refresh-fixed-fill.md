---
'@liquidglassjs/core': patch
---

Re-point an alpha-glass filter as the page scrolls, when the target's fill is anchored
to the viewport.

Two known behaviours meet badly. Safari caches filter output by id, and a
`background-attachment: fixed` fill is painted against the viewport — so the element's
own appearance changes with every scrolled pixel while the cached filter output does
not. The glass keeps showing the fill as it was when the id was minted: right when it
was first rasterized, drifting afterwards, and right again the instant anything mints a
new id, which is why switching a face and back "fixed" it.

A glass heading whose letterforms are filled by a fixed page backdrop is exactly that
shape and a perfectly normal thing to build. `needsScrollRefresh()` is true only where
both halves apply — WebKit, and a target with a fixed-attachment background — and the
listener is attached nowhere else. It renames the filter on a scrolled frame while the
element is on screen: no map is re-encoded, and `refreshGlassFilter` is already a no-op
off WebKit. Verified: scrolling past the section takes the filter id `-4` → `-5` in
WebKit and leaves it untouched in Chromium and Gecko.

The cost, measured while scrolling past that section: p50 unchanged at 39ms, p90
40 → 42, p99 44 → 55. It buys a correct picture on the one target that needs it.
