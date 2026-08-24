---
'@liquidglassjs/core': minor
'@liquidglassjs/react': minor
'@liquidglassjs/element': minor
---

`behind`: glass over live page content it doesn't own — the floating-navbar
case — now refracts for real on Firefox.

Pass `behind` (an element or selector; a SIBLING scene, not an ancestor) and
on Gecko the surface's background becomes `-moz-element()` of that element — a
LIVE image of real DOM, so things scrolling, animating or playing beneath the
glass show through bent, with no clone to sync and no snapshot to go stale.
Alignment is pure `background-position` (the source's viewport offset minus
the surface's), rewritten rAF-coalesced on scroll and resize; the filter is
the ordinary displacement chain with the explicit userSpaceOnUse region.

Coverage for the navbar case becomes: Chromium ✓ (the frost path's
`backdrop-filter: url()` already refracts the real page — `behind` falls
through to it), Firefox ✓ (this path), WebKit ✗ (no backdrop route exists;
bug 245510 — stays on the frosted blur).

The module is lazy-imported behind a capability probe
(`CSS.supports('background-image', '-moz-element(#a)')`) exactly like the
WebGL escape hatch — bundlers can't tree-shake by runtime engine, so the
code-split is ours, and non-Gecko users download none of it. `-moz-element()`
is prefixed and non-standard; if Firefox ships `feDisplacementMap` inside
`backdrop-filter` (the WebRender follow-up Mozilla has invited patches for),
this path retires in favour of the native one.

A standalone bench ships at `/behind` in the showcase — open it in Firefox,
Chrome and Safari side by side: a fixed glass bar over a page with a ticking
clock and a sliding marquee, which stay live through the bend where the
engine can and report which path mounted.
