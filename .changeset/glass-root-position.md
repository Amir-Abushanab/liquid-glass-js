---
'@liquidglassjs/core': patch
---

Stop the glass root's stylesheet from overriding a position the consumer already
chose. A `<LiquidGlass className="absolute inset-0">` was silently collapsing to zero
height and rendering no glass at all.

`.ps-glass` is added to the root by `mountGlass`, so it arrives alongside whatever
classes the consumer put there — and the stylesheet declared `position: relative` on
it. That is unwinnable from CSS: Tailwind v4 puts its utilities in `@layer utilities`,
**unlayered CSS beats any layer regardless of specificity**, and this sheet is
unlayered, so `.ps-glass` overrode `.absolute` even when rewritten as `:where(.ps-glass)`
at zero specificity. With `position: relative` in force, `inset-0` stops sizing the
element, it collapses to zero height, and every renderer bails before building a filter
— glass that isn't there, with nothing in the console to say so.

The surface, tint and rim are positioned against the root, so it does have to be a
containing block — but *any* non-static position is one, and `absolute` is a perfectly
good answer. `position` is out of the stylesheet; `mountGlass` fills it in from script
only when the computed position is still `static`. One `getComputedStyle` read at
mount, and the consumer's choice always wins.

The rest of the root rule (radius, overflow, isolation) moves to `:where()` while it's
being touched — those are defaults, not decisions.
