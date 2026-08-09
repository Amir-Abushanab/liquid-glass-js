// Applying an SVG filter to an HTML element, with WebKit's coordinate origin
// pinned. Every renderer here goes through this — a filter that positions
// anything in `userSpaceOnUse` is silently wrong in Safari without it.
//
// THE BUG
//
// WebKit resolves userSpaceOnUse coordinates on a filter applied to an HTML
// element — BOTH the filter region and any primitive subregion — against the page
// origin instead of the element's own origin, unless the element establishes a
// coordinate system of its own. Measured on a 200x200 element at page (50,50),
// with a filter region at x=0 y=0 and an feImage subregion at x=60 y=60:
//
//                    subregion lands   region lands
//     webkit             60,60            0,0        <- element origin ignored
//     firefox           110,110          50,50
//     chromium          110,110          50,50
//
// So the map went wherever the element happened to sit in the document: further
// down the page, further off. That is the single cause behind the lens appearing
// to split into a stuck layer and a moving one, glass text and glass marks
// rendering as blank space (their chain ends in `operator="in"` against
// SourceAlpha, so a map that landed elsewhere clips the result to nothing), glass
// images cutting off, and controls losing their backdrop while pressed.
//
// THE FIX
//
// Any transform-family property on the element normalises the origin, in every
// engine:
//
//     none            webkit  60,60 / 0,0
//     transform       webkit 110,110 / 50,50   correct
//     translate       webkit 110,110 / 50,50   correct
//     scale           webkit 110,110 / 50,50   correct
//     rotate          webkit 110,110 / 50,50   correct
//     perspective     webkit  60,60 / 0,0      (not a transform — no help)
//
// A real non-identity transform works too, and all three engines then agree on
// the scaled result, so this composes with a page that transforms the element.
//
// We use the `rotate` longhand rather than `transform` so we never clobber a
// `transform` the page owns, and only when the element has no transform-family
// property at all — if it has one, its origin is already correct and we leave it
// alone. The identity costs nothing in side effects: an element with a `filter`
// is already a stacking context and already a containing block for positioned
// descendants, so an identity transform changes neither.

const TRANSFORM_PROPS = ['transform', 'translate', 'scale', 'rotate'] as const;
const PINNED = 'lgFilterOrigin';

// Does the page already give this element its own coordinate system?
function hasOwnOrigin(el: HTMLElement): boolean {
  const cs = getComputedStyle(el) as unknown as Record<string, string | undefined>;
  return TRANSFORM_PROPS.some((p) => {
    const v = cs[p];
    return !!v && v !== 'none';
  });
}

/** Apply `filter: url(#id)` to `el`, pinning WebKit's filter origin to the element. */
export function applyGlassFilter(el: HTMLElement, id: string): void {
  if (!el.dataset[PINNED] && !hasOwnOrigin(el)) {
    el.style.rotate = '0deg';
    el.dataset[PINNED] = '1';
  }
  el.style.filter = `url(#${id})`;
  el.style.setProperty('-webkit-filter', `url(#${id})`);
}

/** Remove the filter and any origin pin we added. */
export function clearGlassFilter(el: HTMLElement): void {
  el.style.filter = '';
  el.style.removeProperty('-webkit-filter');
  if (el.dataset[PINNED]) {
    el.style.removeProperty('rotate');
    delete el.dataset[PINNED];
  }
}
