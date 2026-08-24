---
'@liquidglassjs/core': patch
---

Don't let an explicitly-undefined option shadow its default. Fixes the glass root
carrying `--g-tint: undefined` (so no tint layer painted), the frosted fallback
computing `blur(NaNpx)` and painting no blur at all outside Chromium, and `blur`,
`spec` and `vibrancy` silently resolving to nothing whenever a caller left them out.

`mountGlass` merged with `{ ...GLASS_DEFAULTS, ...opts }`. Every binding forwards the
whole option list — the React one destructures all seventeen props and passes each by
name — so a prop the caller simply didn't set arrives as an explicit `tint: undefined`
key, and a plain spread lets it win. Only options the caller passed are merged now,
which is the same guard `mountGlassShape`, `mountGlassText` and `mountGlassLoupe`
already applied to theirs.

Surfaces that relied on the accidental behaviour will look different, because they were
running without the defaults they asked for: a frosted panel that never passed `blur`
was refracting a sharp backdrop and now diffuses it, which is what `blur: 2` means.
Pass `blur={0}` to keep the old look.
