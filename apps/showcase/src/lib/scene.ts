/**
 * The backdrop every registry preview sits on.
 *
 * It lives here rather than in the site components because the registry passes the
 * same value to `<GlassSurface backdrop={SCENE}>`: the SVG clone path repaints the
 * page's own background behind the glass and refracts THAT, so the value the preview
 * paints and the value the glass is told about have to be one constant, not two that
 * agree by hand.
 */
export const SCENE =
  'repeating-linear-gradient(0deg, rgb(255 255 255 / 12%) 0 1px, transparent 1px 26px),' +
  'repeating-linear-gradient(90deg, rgb(255 255 255 / 12%) 0 1px, transparent 1px 26px),' +
  'radial-gradient(60% 80% at 15% 20%, #ff4f9d, transparent 60%),' +
  'radial-gradient(70% 80% at 85% 25%, #12d3ff, transparent 60%),' +
  'radial-gradient(70% 80% at 60% 100%, #ffc93f, transparent 60%),' +
  'linear-gradient(135deg, #7b3cff, #1f9dff 50%, #22e39b)';
