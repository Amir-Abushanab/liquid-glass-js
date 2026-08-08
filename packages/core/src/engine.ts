// Engine capability gates.
//
// Every renderer here delivers its displacement map the same way: rasterize a dome
// field to a PNG data URI, then hand it to the filter through `<feImage>`. That
// primitive is the single point all the glass depends on — and it is Chromium-only.
//
// Measured with a red-over-blue tell (an opaque red map composited `over` a blue box,
// so a red result means the map arrived), across Playwright 1.61's webkit-2311 and
// firefox-1532:
//
//   feImage data-uri, userSpaceOnUse   webkit 127,0,128   firefox 0,0,255   chromium PASS
//   feImage data-uri, default units    webkit 223,0,32    firefox 0,0,255   chromium PASS
//   feImage -> #element reference      webkit 125,0,130   firefox 0,0,255   chromium PASS
//   feFlood only (control)             webkit PASS        firefox PASS      chromium PASS
//
// The control passing everywhere is the point: filters themselves work in all three.
// It is this one primitive. Firefox ignores external and data references in `feImage`
// outright; WebKit renders something, but not the map it was given.
//
// Why this hid for so long: a map that never arrives leaves `feDisplacementMap` a
// neutral grey field, which displaces by exactly zero. The surface still blurs and
// tints, so it goes on looking like glass — it just stops bending. Any check that
// asks "did the filter apply?" passes. Only a check that asserts on *displacement*
// catches it.
//
// And it is worse than cosmetic on WebKit. The alpha-shaped renderers finish with
// `feComposite operator="in"` against `SourceAlpha`; when the lit result is empty,
// that clip yields nothing and the element's content disappears outright — glass
// text, glass marks and the frosted cards all render as blank space.
//
// There is no capability probe available: DOM has no pixel readback, so nothing can
// observe that a filter painted. The engine is the only signal, exactly as it is for
// `backdrop-filter: url()`. `navigator.userAgentData` is Chromium-only and cheaper
// than a UA regex, with a UA fallback for non-secure contexts where it's undefined.
//
// Both failure directions are safe by construction: a false negative renders the
// content plainly (no glass), and a false positive is what every non-Chromium engine
// does today anyway.

let cached: boolean | undefined;

/** Is this a Chromium engine? The only tell available for the gaps below. */
export function isChromium(): boolean {
  if (cached !== undefined) return cached;
  try {
    if (typeof navigator === 'undefined') return (cached = false);
    const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } })
      .userAgentData?.brands;
    if (brands) return (cached = brands.some((b) => /Chromium/i.test(b.brand)));
    return (cached = /Chrome\/|Chromium\//.test(navigator.userAgent));
  } catch {
    return (cached = false);
  }
}

/**
 * Will `<feImage>` actually deliver a displacement map to a filter here?
 *
 * Renderers should check this before applying `filter: url(…)`. Where it's false the
 * filter can only subtract — it cannot bend anything, and on WebKit it erases the
 * content it was meant to refract — so the right move is to leave the element alone
 * and let it render plainly.
 */
export function supportsDisplacementMaps(): boolean {
  return isChromium();
}

/** Test seam: force the gate on or off. Pass `undefined` to restore detection. */
export function __setEngineOverride(value: boolean | undefined): void {
  cached = value;
}
