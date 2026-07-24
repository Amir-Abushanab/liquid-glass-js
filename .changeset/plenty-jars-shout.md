---
'@liquidglassjs/qr': minor
---

Make the Glass QR's payload and branding the consumer's, not the author's.

**`logo` option.** The centre mark was hardcoded to the built-in glass mark with
no way to change it — for a QR, where the centre is inherently consumer-branded,
that meant every adopter hit it immediately (and worked around it by reaching
into `.ps-qr__logo-rotator`, an internal class). Now
`logo?: string | Node | false`, defaulting to the built-in mark. `logo: false`
drops the button entirely.

**`reserveCenter` replaces `image`.** `image` only controlled whether the
*geometry* reserved the centre; the logo button rendered either way, so
`image: false` produced a mark sitting on live modules. Center reservation now
follows `logo` by default, and `reserveCenter` is the explicit override for the
rare hole-without-a-mark case. `image` still works as a deprecated alias.

**BREAKING (types): `value` is required.** It defaulted to
`https://principlestash.com` — the author's own site. A QR silently encoding
someone else's URL is the worst failure this package has, since the whole point
of the element is the payload. `mountGlassQR(container, opts)` no longer accepts
a missing `opts`. Callers already passing `value` need no change.
