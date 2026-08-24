---
'@liquidglassjs/core': patch
---

Round the WebGL canvas in Firefox for real.

Gecko's compositor ships a live canvas's layer square: the wrapper's rounded
overflow, `border-radius` on the canvas, and even `clip-path` on the canvas
are all skipped (verified windowed on Firefox 154 with a variant bench;
headless/software WebRender renders every variant correctly, which is why the
first two fixes looked plausible and weren't). The canvas now carries
`clip-path: inset(0 round var(--g-radius))` plus — Gecko-gated on
`-moz-element` support, since elsewhere it would only tax direct compositing —
a visually-no-op fully-opaque `mask-image: linear-gradient(#000 0 0)` that
forces the element off the compositor fast path, where the clip finally
applies. Corners verified clean in windowed Firefox on the production mount.
