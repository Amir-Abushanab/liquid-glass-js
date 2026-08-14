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

// WebKit, and not Chromium (which also ships AppleWebKit in its UA). Three separate
// workarounds below gate on this. Same shape as supportsBackdropUrl()'s engine test
// in mount.ts, and for the same reason: none of these have a feature test — observing
// them needs a rasterized readback of a DOM element — so the engine is the only signal.
let _isWebKit: boolean | null = null;
function isWebKit(): boolean {
  if (_isWebKit !== null) return _isWebKit;
  try {
    const ua = navigator.userAgent;
    _isWebKit = /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua);
  } catch {
    _isWebKit = false;
  }
  return _isWebKit;
}

/**
 * Re-point `el` at `filter` under a fresh id, forcing Safari to re-evaluate it.
 * Returns the id now in effect — assign it back to whatever the caller tracks.
 *
 * Safari caches filter output by id (the reason every map rebuild in this codebase
 * already mints a new one). Mutating a primitive's attributes under an unchanged id
 * therefore leaves the element painted with the *cached* result: the per-frame paths
 * — lens setPos, ripple frame, morph setBox — freeze at whatever the filter produced
 * when its id was created. That is the stuck second layer the lens leaves behind, the
 * ripple that never animates, and the switch that won't follow a drag.
 *
 * Renaming only re-points; the map (the feImage href) is untouched, so no displacement
 * map is rebuilt and no PNG is re-encoded. It is still not free — renaming every frame
 * measurably worsens the frame-time tail (firefox p90 8.9ms -> 58.8ms, chromium 9.2ms
 * -> 16.6ms, medians unchanged) — and Chromium and Gecko re-run the filter on an
 * attribute change anyway, so they skip it and keep the cheap path.
 */
export function refreshGlassFilter(el: HTMLElement, filter: SVGFilterElement, id: string): string {
  if (!isWebKit()) return filter.id;
  filter.setAttribute('id', id);
  el.style.filter = `url(#${id})`;
  el.style.setProperty('-webkit-filter', `url(#${id})`);
  return id;
}

/**
 * Multiplier to apply to every `primitiveUnits="userSpaceOnUse"` value in a filter
 * targeting `el`. 1 for everything except the case below.
 *
 * When the filtered element is an inline <svg> carrying a viewBox whose units are
 * not CSS px, WebKit resolves primitive values in the SVG's OWN user units while
 * Chromium and Gecko use CSS px — and it does this to the whole primitive
 * coordinate space, positions and lengths alike. On a 64-unit viewBox drawn at
 * 200px (3.125x), measured:
 *
 *   feImage subregion x=20 y=20 100x100   webkit 112,112 (clipped 138)  others 70,70 100x100
 *   feOffset dx=20 (a pure length)        webkit shifts 63px            others shift 20px
 *
 * So a glass mark got its map drawn 3x oversized and offset — the artwork lost its
 * rim and showed a dark misplaced crescent — and its displacement and blur were
 * scaled up to match. The filter REGION is unaffected: filterUnits resolves in CSS
 * px in every engine, including WebKit, on the same element.
 *
 * Multiplying primitive values by viewBoxWidth/cssWidth cancels it exactly. The
 * ratio is 1 for HTML targets, for an <svg> with no viewBox, and for a viewBox whose
 * units already are CSS px, so the same code path serves every case.
 */
export function primitiveScale(el: Element): number {
  if (!isWebKit()) return 1; // only WebKit rescales
  if (typeof SVGSVGElement === 'undefined' || !(el instanceof SVGSVGElement)) return 1;
  const vb = el.viewBox?.baseVal;
  const r = el.getBoundingClientRect();
  if (!vb || !vb.width || !vb.height || !r.width || !r.height) return 1;
  return vb.width / r.width;
}

// Below this, a pre-blur is a no-op in Chromium and pure damage in WebKit — but NOT
// a no-op in Gecko, which is why the skip is engine-gated. See preBlur().
const MIN_BLUR = 0.75;

/**
 * The optional pre-blur in front of a displacement chain, as `[markup, inputName]`.
 * Feed `inputName` to whatever consumes the blurred source.
 *
 * WebKit's feGaussianBlur desaturates a partially transparent source, and it charges
 * the full cost the moment the primitive exists at all rather than in proportion to
 * stdDeviation — measured on a translucent canvas of colour emoji, mean saturation:
 *
 *   stdDeviation   0     0.2    0.35   0.5    0.75   1      1.5    2      3
 *     webkit     124.1   95.9   95.9   95.9   95.9   95.9   95.9   82.3   73.9
 *     firefox    123.6  123.6  122.7  117.4  109.6  104.2   95.3   85.9   76.2
 *     chromium   123.8  123.8  123.8  123.8  123.8  102.7   95.7   86.0   76.1
 *
 * WebKit drops 23% at 0.2 and stays flat to 1.5 — a premultiply round-trip charged
 * once, not a Gaussian. It barely shows on opaque sources (52.6 -> 50.2) and wrecks
 * translucent ones: a 0.4px blur nobody can see cost the emoji orb a quarter of its
 * colour.
 *
 * The skip is gated to WebKit because the other two engines do not agree on what
 * "negligible" means. Chromium is flat to 0.75, so dropping the primitive under that
 * is genuinely invisible there — but Gecko starts responding around 0.35 and is down
 * 5% at 0.5, which is the lens default. Skipping it everywhere would quietly remove a
 * blur Firefox was really applying, so only the engine with the bug pays the
 * workaround.
 */
export function preBlur(blur: number, result = 'blurred'): [string, string] {
  if (isWebKit() && !(blur >= MIN_BLUR)) return ['', 'SourceGraphic'];
  return [
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="${result}"></feGaussianBlur>`,
    result,
  ];
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
