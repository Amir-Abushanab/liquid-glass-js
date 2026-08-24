---
'@liquidglassjs/core': minor
---

Honour the OS legibility and motion settings, following Apple's own tiers for
Liquid Glass: reduced transparency goes frostier, increased contrast goes
mostly solid with a contrasting border, reduced motion "disables any elastic
properties".

- The shipped CSS answers `prefers-reduced-transparency: reduce` (tint raised
  to 80% paper) and `prefers-contrast: more` (92% paper + a 1.5px 70%-ink
  rim). Both key off `--glass-paper`/`--glass-ink`, so themed consumers keep
  their palette. The query split is deliberate: Safari has never shipped
  `prefers-reduced-transparency`, so `prefers-contrast` is the tier Safari
  users can actually reach.
- All built-in motion — `glassTween`, `createSpring`, the button/dropdown
  morphs, the ripple bloom — honours `prefers-reduced-motion` on its own
  (state changes land, bounces don't; the ripple, pure ornament, is skipped
  whole). `prefersReducedMotion()` is exported for hand-rolled rAF loops.
