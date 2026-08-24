---
'@liquidglassjs/core': patch
---

Don't apply an alpha-glass filter until its map has decoded, and re-point it when the
element comes into view. Fixes glass text and glass marks below the fold rendering
flat on first sight and only coming good once something rebuilt them.

The map is a data-URL PNG handed to `feImage`, and an `feImage` that hasn't decoded yet
contributes nothing: `feComposite in="rawMap" in2="mapBg" operator="over"` falls
through to the neutral flood, every displacement is zero, and the glyphs paint flat and
unrefracted. Unlike the lens, this chain is built once and never re-runs on its own, so
it stays wrong until something else rebuilds it — which is why switching typeface and
back "fixed" it. `regen` now awaits `img.decode()` before applying the filter, with a
generation check so a newer map can overtake an older one mid-await.

Second, Safari keys filter output by id (see `refreshGlassFilter`). An element that
mounted below the fold can be painted from what was cached before it was ever on
screen, and nothing in this renderer would ask again. An `IntersectionObserver` now
re-points the filter on entry — a rename, so no map is re-encoded, and a no-op off
WebKit. Verified: entering the viewport takes the filter id from `-1` to `-2` in
WebKit and leaves it untouched in Chromium and Gecko.

Both are first-paint races that a headless harness doesn't reproduce — twelve of twelve
maps already measured decoded there — so this is aimed at the two mechanisms that fit
the symptom rather than at a reproduction.
