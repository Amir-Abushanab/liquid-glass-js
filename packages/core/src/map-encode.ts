// Shared displacement-map wire format — the one place the RGBA encoding lives.
//
// Both generators (displacement.ts's dome, glyph-map.ts's text) and every SVG
// consumer (glass-lens, glass-text, svg-ripple, glass-morph, mount) go through
// here so the R/G offset + B specular encoding and the specMask matrix can never
// drift apart. Historically each site inlined the math with its own sign
// convention, which is exactly the trap that silently breaks the illusion.
//
// Wire format (see IMPROVEMENTS.md invariant 1): RGBA, alpha 255 at every pixel.
//   R = X offset, G = Y offset — byte > 128 makes feDisplacementMap sample from
//       the positive axis direction; 128 = no shift.
//   B = specular — byte = round(127·r + 128); 128 = no glint.

export const NEUTRAL_BYTE = 128;
export const NEUTRAL = 0.5019607843137255; // 128/255

const clamp1 = (x: number): number => (x < -1 ? -1 : x > 1 ? 1 : x);

/**
 * Encode an offset channel (R or G). `dir` ∈ [−1, 1] is the direction to SAMPLE
 * FROM, in units of scale/2: +1 → the positive axis (byte 255), −1 → negative
 * (byte 0), 0 → no shift (128). Out-of-range saturates, matching the old inline
 * `round((0.5 ± 0.5·…)·255)` written into a Uint8ClampedArray (proven identical).
 */
export function encodeOffset(dir: number): number {
  return Math.round((0.5 + 0.5 * clamp1(dir)) * 255);
}

/**
 * Encode the B specular channel. `r` ∈ [−1, 1]: the positive half is the lit
 * glint; the negative half (item 2's dark rim) darkens. 128 = none. Generators
 * historically clamped `r` to ≤ 1 by hand before `round(127·r + 128)`; this
 * folds that clamp in.
 */
export function encodeSpec(r: number): number {
  return Math.round(127 * clamp1(r) + 128);
}

/**
 * The `feColorMatrix` `values` string every consumer uses to turn the map's B
 * channel into the specular glint: pulls B into alpha (α = B − NEUTRAL, clamped
 * ≥ 0 by the pipeline) and floods the colour with `tint` (default white). A
 * colour tint rides through unchanged because the spec composite is an
 * arithmetic add in premultiplied space (item 6).
 */
export function specMaskValues(tint: readonly [number, number, number] = [1, 1, 1]): string {
  return `0 0 0 0 ${tint[0]}  0 0 0 0 ${tint[1]}  0 0 0 0 ${tint[2]}  0 0 1 0 -${NEUTRAL}`;
}

/**
 * The dark-rim mask (item 2): floods white and pulls α = NEUTRAL − B, clamped
 * ≥ 0 by the pipeline — so it is fully transparent wherever the map wrote
 * B ≥ 128 (NEUTRAL − 128/255 = 0 exactly) and opaque only on the dark rim
 * (B < 128). Composited multiplicatively (`out = lit·(1 − dark)`), so at
 * `shade: 0` it contributes nothing and the render stays byte-identical.
 */
export function darkMaskValues(): string {
  return `0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 -1 0 ${NEUTRAL}`;
}
