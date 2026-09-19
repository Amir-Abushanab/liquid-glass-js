// Measuring an element in its own coordinates, which is where every map is drawn.
//
// A displacement map is sampled in the filtered element's local space, before any
// transform on it or its ancestors, so the map has to be the size of the element's
// layout box. getBoundingClientRect() reports the transformed box instead, and a
// panel that animates in from `scale(.95)` (every dialog, menu and popover) or sits
// in a card being revealed at a tilt measures a few percent off. The transform then
// settles without the layout box changing, so no ResizeObserver fires, the map is
// never rebuilt, and the rim stays traced inside the panel it belongs to.

/**
 * The element's own layout box in CSS px, ignoring any transform on it or an ancestor.
 * offsetWidth/Height are that box. They don't exist for inline or SVG hosts, so fall
 * back to the rect there.
 */
export function layoutBox(el: HTMLElement): { width: number; height: number } {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (w && h) return { width: w, height: h };
  const r = el.getBoundingClientRect();
  return { width: Math.round(r.width), height: Math.round(r.height) };
}

/**
 * How much the transforms on an element and its ancestors scale it on screen, per
 * axis: its rect over its layout box. Divide a length read off
 * getBoundingClientRect() by this to have it back in the element's own px, for
 * whatever has to be measured from rects (a pill's position mid-slide, a text's
 * baseline). 1 where there's no layout box to compare with. A rotation reads as a
 * little extra scale (the rect is its bounding box), so it's exact for scale and
 * translation, which are what panels animate in with.
 */
export function screenScale(
  el: HTMLElement,
  rect: DOMRect = el.getBoundingClientRect(),
): { x: number; y: number } {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  return {
    x: w > 0 && rect.width > 0 ? rect.width / w : 1,
    y: h > 0 && rect.height > 0 ? rect.height / h : 1,
  };
}
