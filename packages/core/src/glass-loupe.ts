// iOS-style magnifying loupe over live DOM — hold on a word, a glass capsule
// floats above your finger showing that word blown up.
//
// The refraction engine is `mountGlassLens` (the same dome/SDF displacement map
// used everywhere else), but a lens alone can't do this: feDisplacementMap BENDS
// pixels, it never scales them. Magnification has to come from somewhere else, so
// the loupe renders a *second copy* of the source — a deep clone, transformed by
// `scale(zoom)` — and points the lens at that:
//
//   source (untouched, still interactive)
//   .ps-loupe            top layer (popover), viewport coords, follows the pointer
//     .ps-loupe__box     w × h, rounded, clipped, shadowed — the visible capsule
//       .ps-loupe__refract   box + bleed on every side; wears the lens filter
//         .ps-loupe__stage   translate(…) scale(zoom) — the cloned DOM
//
// Why a clone and not a canvas: cloned DOM is real text, so it stays vector-crisp
// at any zoom (a rasterized snapshot would go soft at exactly the moment the user
// asked for detail) and it costs no dependency. The price is that it's a snapshot
// — see `refresh()`.
//
// Why the bleed ring: an SVG filter can only bend pixels it was given. If the
// refract box ended at the visible rim there'd be nothing outside to pull inward
// and the edge would smear instead of refract. So the filter target is inset by
// `-bleed` and the lens is positioned at (bleed, bleed) — same trick as
// `.ps-glass__refract`'s `--g-margin`. The extra ring is clipped away by the box.
//
// Why the top layer: a loupe that gets clipped by an ancestor's `overflow: hidden`
// is a dead feature, but re-parenting the clone to <body> would drop every
// descendant selector styling it (`.article p { … }` no longer matches). A popover
// gets both — top-layer painting escapes all clipping and stacking contexts, while
// the element stays where it is in the DOM, so inheritance and selectors still see
// its real ancestors.

import { mountGlassLens, type GlassLens, type GlassLensParams } from './glass-lens';

/** Live-tunable loupe params: the lens refraction, plus the magnifier's own geometry. */
export interface GlassLoupeParams extends GlassLensParams {
  /** Magnification factor. iOS sits around 1.5×. */
  zoom: number;
  /** Capsule width in CSS px. */
  width: number;
  /** Capsule height in CSS px. */
  height: number;
  /** Vertical offset of the capsule from the sampled point (negative = above the finger). */
  offsetY: number;
  /**
   * Hold before a `'longpress'` opens, in ms (iOS is ~500). Live-tunable, and read
   * at pointerdown, so a change applies to the next gesture rather than the
   * one in flight. Ignored by the other triggers.
   */
  longPressMs: number;
}

/** How the loupe opens. `'none'` binds nothing — drive it with show/move/hide. */
export type GlassLoupeTrigger = 'longpress' | 'press' | 'hover' | 'none';

/** What the loupe is currently magnifying — handed to onShow/onMove. */
export interface GlassLoupeSample {
  /** Viewport point under the lens, after line-snapping and clamping. */
  x: number;
  y: number;
  /** Raw pointer position, before snapping. */
  pointerX: number;
  pointerY: number;
  /** Text position under the pointer, when there is one (drives selection UIs). */
  caret: { node: Node; offset: number; rect: DOMRect } | null;
}

export interface GlassLoupeOptions extends Partial<GlassLoupeParams> {
  /** The element to magnify. Cloned on open; never mutated. */
  source: HTMLElement;
  /**
   * Where the loupe node is appended. Defaults to the source's parent, which keeps
   * the clone under the same CSS ancestors as the original (so descendant selectors
   * still match). Painting escapes it via the top layer either way.
   */
  host?: HTMLElement;
  /** Built-in gesture. Default `'longpress'`. */
  trigger?: GlassLoupeTrigger;
  /** Movement in px that cancels a pending long-press (it was a scroll). Default 10. */
  moveTolerance?: number;
  /**
   * Snap the sampled point to the vertical centre of the text line under the pointer,
   * so the loupe rides the baseline instead of bobbing. Default true.
   */
  snapToLine?: boolean;
  /** Keep the magnified window inside the source, so the capsule never shows blank paper. Default true. */
  clamp?: boolean;
  /**
   * Suppress the platform's own selection UI on the source, so iOS Safari doesn't
   * answer a long-press with its *native* loupe and callout bar on top of ours.
   * Defaults to true for `'longpress'`, false otherwise.
   *
   * `-webkit-touch-callout: none` and `touch-action: none` are set for the whole
   * mount — both are touch-only, so a mouse notices neither, though the second does
   * stop the source scrolling under touch. `user-select: none` is scoped to the
   * gesture instead of the mount: taken at pointerdown for touch (where a drag
   * scrolls anyway) but only once the hold has won for a mouse, so click-and-drag
   * still selects text normally. Pass `false` and run your own gesture with
   * `trigger: 'none'` to opt out of all of it.
   */
  suppressNative?: boolean;
  /**
   * What fills the capsule behind the magnified copy. The clone only carries the
   * source's own painting, so a source with a transparent background would let the
   * *unmagnified* page show through behind the magnified text. By default the
   * loupe walks up from the source for the first opaque background colour and uses
   * that. Pass a CSS colour to override, or `false` to stay transparent (right when
   * the source paints its own background, or when you want a see-through loupe).
   */
  backdrop?: string | false;
  /** CSS colour for the specular glint (default white). Mount-only. */
  glint?: string;
  /** Extra class(es) on the loupe root, for styling the capsule. */
  class?: string;
  onShow?: (sample: GlassLoupeSample) => void;
  onMove?: (sample: GlassLoupeSample) => void;
  onHide?: () => void;
}

export interface GlassLoupe {
  /** Open at a viewport point, snapshotting the source. */
  show(clientX: number, clientY: number): void;
  /** Move an open loupe. No-op when closed. */
  move(clientX: number, clientY: number): void;
  hide(): void;
  /** Re-snapshot the source — call after the source's content or layout changes. */
  refresh(): void;
  reconfigure(patch: Partial<GlassLoupeParams>): void;
  getOptions(): GlassLoupeParams;
  isOpen(): boolean;
  /** The loupe root, for styling or manual placement. */
  readonly element: HTMLElement;
  dispose(): void;
}

export const GLASS_LOUPE_DEFAULTS: GlassLoupeParams = {
  zoom: 1.55,
  width: 132,
  height: 44,
  offsetY: -54,
  longPressMs: 400,
  // The rim does the work: it bends and splits hard while the middle stays flat, so
  // the magnified text reads cleanly and the glass still announces itself. Blur is
  // the one param that has to stay near zero — magnified glyphs are the whole point.
  radius: 22,
  depth: 5,
  dome: 7,
  edge: 0.9,
  glow: 0.4,
  strength: 16,
  chroma: 0.6,
  blur: 0.15,
  shade: 0.12,
};

const PARAM_KEYS = [
  'zoom',
  'width',
  'height',
  'offsetY',
  'longPressMs',
  'radius',
  'depth',
  'dome',
  'edge',
  'glow',
  'strength',
  'chroma',
  'blur',
  'shade',
] as const;

// The params baked into the displacement map or the capsule's box — the ones whose
// change forces a layout() rebuild. Everything else in GlassLoupeParams is read per
// gesture or per frame, so it costs nothing to change.
const LAYOUT_KEYS = new Set<string>([
  'width',
  'height',
  'radius',
  'depth',
  'dome',
  'edge',
  'glow',
  'strength',
  'chroma',
  'blur',
  'shade',
]);

const clampTo = (v: number, lo: number, hi: number): number =>
  hi < lo ? (lo + hi) / 2 : v < lo ? lo : v > hi ? hi : v;

// Vertical offset of an element in *layout* px, summed up the offsetParent chain.
// Deliberately not getBoundingClientRect: the loupe scales the whole capsule as it
// opens, and a painted-px measurement inside it would fold that animation in — the
// correction it feeds would then depend on when during the animation it ran.
function absTop(el: HTMLElement): number {
  let y = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null)
    y += n.offsetTop;
  return y;
}

// The nearest opaque background colour at or above `el`. The clone reproduces only
// the source's own painting, so whatever an ancestor was painting behind it has to
// be re-created inside the capsule — otherwise the magnified text floats over a
// see-through hole showing the page at 1×.
function opaqueBackdrop(el: HTMLElement | null): string {
  for (let node = el; node; node = node.parentElement) {
    const bg = getComputedStyle(node).backgroundColor;
    // Anything with a non-zero alpha will do; rgba(…, 0) and `transparent` won't.
    if (bg && bg !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(bg)) return bg;
  }
  return 'Canvas'; // system light/dark page background — the UA's own default
}

// The character box under a viewport point. `caretPositionFromPoint` is the
// standard; WebKit shipped `caretRangeFromPoint` first and older Safari has only
// that. A collapsed caret has no height, so we widen it by one character — that
// rect is the line's own metrics, which is what we snap to.
function caretAt(x: number, y: number, within: HTMLElement): GlassLoupeSample['caret'] {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  let node: Node | null = null;
  let offset = 0;
  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos) {
      node = pos.offsetNode;
      offset = pos.offset;
    }
  } else if (typeof doc.caretRangeFromPoint === 'function') {
    const r = doc.caretRangeFromPoint(x, y);
    if (r) {
      node = r.startContainer;
      offset = r.startOffset;
    }
  }
  // Hit-testing answers for the whole page, so something overlapping the source
  // could hand back a caret in unrelated text. Only the source's own text counts.
  if (!node || node.nodeType !== Node.TEXT_NODE || !within.contains(node)) return null;
  const text = node.nodeValue ?? '';
  if (!text.length) return null;
  const start = Math.min(offset, text.length - 1);
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + 1);
  const rect = range.getBoundingClientRect();
  if (!rect.height) return null;
  return { node, offset, rect };
}

export function mountGlassLoupe(o: GlassLoupeOptions): GlassLoupe {
  const source = o.source;
  const host = o.host ?? source.parentElement ?? document.body;
  const trigger: GlassLoupeTrigger = o.trigger ?? 'longpress';
  const moveTolerance = o.moveTolerance ?? 10;
  const snapToLine = o.snapToLine !== false;
  const doClamp = o.clamp !== false;
  const suppressNative = o.suppressNative ?? trigger === 'longpress';

  const explicit: Partial<GlassLoupeParams> = {};
  PARAM_KEYS.forEach((k) => {
    if (o[k] != null) explicit[k] = o[k];
  });
  const cur: GlassLoupeParams = { ...GLASS_LOUPE_DEFAULTS, ...explicit };

  // ── DOM ──
  const root = document.createElement('div');
  root.className = 'ps-loupe' + (o.class ? ' ' + o.class : '');
  // Marker for anything that needs to know it's rendering inside a loupe rather
  // than in the page — custom elements especially (see the note in snapshot()).
  root.dataset.psLoupe = '';
  root.setAttribute('aria-hidden', 'true'); // decorative: the real content is right there underneath
  // The clone is a dead copy — keep it out of the a11y tree, out of the tab order,
  // and out of hit-testing so the gesture keeps reaching the source below.
  root.inert = true;
  const box = document.createElement('div');
  box.className = 'ps-loupe__box';
  const refract = document.createElement('div');
  refract.className = 'ps-loupe__refract';
  const stage = document.createElement('div');
  stage.className = 'ps-loupe__stage';
  // The rim can't be an inset box-shadow on the box: inset shadows paint under an
  // element's children, and the magnified clone is opaque. It gets its own layer.
  const rim = document.createElement('div');
  rim.className = 'ps-loupe__rim';
  refract.appendChild(stage);
  box.appendChild(refract);
  box.appendChild(rim);
  root.appendChild(box);

  // Structural CSS lives here rather than in glass.css: without it the effect is
  // not merely unstyled, it's broken (unclipped clone, no bleed ring). glass.css
  // owns the *look* — shadow, rim, open/close transition.
  //
  // The `[popover]` UA sheet is opinionated (inset:0, margin:auto, a border, a
  // background, and `color: canvastext` — which would repaint the clone's text in
  // the UA's colour). Every one of those is neutralised here.
  root.style.cssText =
    'position:fixed;left:0;top:0;right:auto;bottom:auto;margin:0;padding:0;border:0;' +
    'background:none;color:inherit;width:fit-content;height:fit-content;' +
    'pointer-events:none;overflow:visible;z-index:2147483000';
  box.style.cssText = 'position:relative;overflow:hidden';
  refract.style.cssText = 'position:absolute';
  stage.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0';
  rim.style.cssText =
    'position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:1';

  // Top layer or bust: a popover paints above every ancestor's `overflow: hidden`
  // and stacking context while staying put in the DOM. Where it's missing we fall
  // back to plain fixed positioning appended to <body>, which can't be clipped
  // either — at the cost of the clone losing its ancestor-dependent styles.
  const canPopover = typeof root.showPopover === 'function';
  if (canPopover) {
    root.popover = 'manual';
    host.appendChild(root);
  } else {
    root.style.display = 'none';
    document.body.appendChild(root);
  }

  let lens: GlassLens | null = null;
  let open = false;
  let bleed = 0;
  let srcW = 0;
  let srcH = 0;
  let lastX = 0;
  let lastY = 0;
  let clearTimer = 0;

  // Geometry that only changes when the params do: capsule size, the bleed ring,
  // and the lens the ring exists for.
  const layout = (): void => {
    const w = Math.round(cur.width);
    const h = Math.round(cur.height);
    // Enough margin for the displacement to have real pixels to reach for, plus
    // the filter region's own slack.
    bleed = Math.ceil(cur.strength) + 12;
    box.style.width = w + 'px';
    box.style.height = h + 'px';
    box.style.borderRadius = Math.min(cur.radius, Math.min(w, h) / 2) + 'px';
    refract.style.left = -bleed + 'px';
    refract.style.top = -bleed + 'px';
    refract.style.width = w + 2 * bleed + 'px';
    refract.style.height = h + 2 * bleed + 'px';
    if (!lens) {
      lens = mountGlassLens({
        target: refract,
        host: root,
        lensW: w,
        lensH: h,
        glint: o.glint,
        radius: cur.radius,
        depth: cur.depth,
        dome: cur.dome,
        edge: cur.edge,
        glow: cur.glow,
        strength: cur.strength,
        chroma: cur.chroma,
        blur: cur.blur,
        shade: cur.shade,
      });
    } else {
      lens.setSize(w, h);
      lens.reconfigure({
        radius: cur.radius,
        depth: cur.depth,
        dome: cur.dome,
        edge: cur.edge,
        glow: cur.glow,
        strength: cur.strength,
        chroma: cur.chroma,
        blur: cur.blur,
        shade: cur.shade,
      });
    }
    // The lens sits at the visible rim, inset from the filter target by the bleed.
    lens.setPos(bleed, bleed);
  };

  // Deep-clone the source. cloneNode copies markup, but three kinds of state live
  // in properties rather than attributes and would come across blank: canvas
  // bitmaps, form values, and scroll offsets. Both trees are structurally
  // identical right after the clone, so a lockstep walk pairs the nodes.
  const snapshot = (): void => {
    // Resolved per open, not once at mount, so a theme toggle between opens lands.
    if (o.backdrop !== false) box.style.background = o.backdrop ?? opaqueBackdrop(source);
    // Measure the clone at 1:1 below; aim() re-applies the real transform right after.
    stage.style.transform = 'none';
    const rect = source.getBoundingClientRect();
    // Size the clone from the *fractional* rect, not offsetWidth/offsetHeight.
    // offset* rounds to whole pixels, and a third of a pixel is enough to reflow a
    // line or re-balance a multi-column source — at which point the copy shows
    // different text from the original at the same coordinates, which is the one
    // thing a magnifier must never do.
    //
    // offset* is still the fallback: the rect is *painted* px, so under a transformed
    // ancestor it isn't a layout size at all. When the two disagree by more than
    // rounding, a transform is in play and the rounded pair is the honest answer.
    const ow = source.offsetWidth;
    const oh = source.offsetHeight;
    const scaled = Math.abs(rect.width - ow) >= 1 || Math.abs(rect.height - oh) >= 1;
    srcW = (scaled ? ow : rect.width) || rect.width;
    srcH = (scaled ? oh : rect.height) || rect.height;

    const clone = source.cloneNode(true) as HTMLElement;
    const from = source.querySelectorAll<HTMLElement>('*');
    const to = clone.querySelectorAll<HTMLElement>('*');
    for (let i = 0; i < from.length && i < to.length; i++) {
      const a = from[i]!;
      const b = to[i]!;
      if (a instanceof HTMLCanvasElement && b instanceof HTMLCanvasElement) {
        // A cloned <canvas> is blank — blit the live bitmap across. Cross-origin
        // content taints the destination, which only blocks readback; we just paint.
        try {
          b.getContext('2d')?.drawImage(a, 0, 0);
        } catch {
          /* tainted or context-less source canvas — leave the clone empty */
        }
      } else if (a instanceof HTMLInputElement && b instanceof HTMLInputElement) {
        b.value = a.value;
        b.checked = a.checked;
      } else if (a instanceof HTMLTextAreaElement && b instanceof HTMLTextAreaElement) {
        b.value = a.value;
      } else if (a instanceof HTMLSelectElement && b instanceof HTMLSelectElement) {
        b.selectedIndex = a.selectedIndex;
      }
      if (a.scrollTop) b.scrollTop = a.scrollTop;
      if (a.scrollLeft) b.scrollLeft = a.scrollLeft;
    }

    // Drop any loupe root that came along for the ride. The source can contain one
    // (a second loupe over a subregion, or — because the clone is inserted into the
    // live document — this loupe's own element re-mounting itself when a cloned
    // custom element gets upgraded and runs `connectedCallback` again).
    clone.querySelectorAll('[data-ps-loupe]').forEach((n) => n.remove());

    clone.style.margin = '0';
    clone.style.position = 'absolute';
    clone.style.left = '0';
    clone.style.top = '0';
    clone.style.boxSizing = 'border-box'; // offsetWidth is a border-box measure
    clone.style.width = srcW + 'px';
    clone.style.height = srcH + 'px';
    stage.replaceChildren(clone);
    if (source.scrollTop) clone.scrollTop = source.scrollTop;
    if (source.scrollLeft) clone.scrollLeft = source.scrollLeft;
  };

  // Absolute positioning gives the clone its own block formatting context, and a BFC
  // stops margins collapsing through it. So a first child whose top margin collapsed
  // *out* of the source (pushing the source itself down the page instead) keeps that
  // margin inside the clone, and every line of the copy sits lower than the original
  // by exactly that much — the loupe would magnify the wrong band. Cheaper to measure
  // the discrepancy than to model when it happens.
  //
  // Runs only once the loupe is actually visible: a closed popover is `display: none`,
  // where nothing has a layout box and the correction would be nonsense. Idempotent —
  // the probe's offset within the clone doesn't move when the clone does.
  const alignClone = (): void => {
    const clone = stage.firstElementChild as HTMLElement | null;
    const probeSrc = source.firstElementChild as HTMLElement | null;
    const probeClone = clone?.firstElementChild as HTMLElement | null;
    if (!clone || !probeSrc || !probeClone) return;
    const dy = absTop(probeClone) - absTop(clone) - (absTop(probeSrc) - absTop(source));
    clone.style.top = dy ? -dy + 'px' : '0';
  };

  // Point the loupe at a viewport coordinate: pick the sample point (snapped and
  // clamped), slide the clone so that point lands dead centre, and place the
  // capsule above it. Runs on every pointermove — no cloning, no map rebuild, just
  // two transforms.
  const aim = (pointerX: number, pointerY: number): GlassLoupeSample => {
    const w = Math.round(cur.width);
    const h = Math.round(cur.height);
    const k = cur.zoom;
    const rect = source.getBoundingClientRect();
    let x = pointerX;
    let y = pointerY;

    // Clamped in two steps, and the caret is looked up between them. Pointer capture
    // means the finger can wander off the source entirely; pulling it back inside
    // first is what keeps the reported caret describing the text the loupe is
    // actually showing, instead of whatever happens to sit under the stray finger.
    if (doClamp) {
      x = clampTo(x, rect.left + 1, rect.right - 1);
      y = clampTo(y, rect.top + 1, rect.bottom - 1);
    }

    const caret = snapToLine ? caretAt(x, y, source) : null;
    if (caret) y = caret.rect.top + caret.rect.height / 2;

    if (doClamp) {
      // The window we're magnifying is w/k × h/k of source, so hold its edges inside.
      x = clampTo(x, rect.left + w / (2 * k), rect.right - w / (2 * k));
      y = clampTo(y, rect.top + h / (2 * k), rect.bottom - h / (2 * k));
    }

    // Source-local coords, undoing any scale a transformed ancestor applied
    // (rect is painted px, the clone is laid out in layout px).
    const scale = srcW ? rect.width / srcW : 1;
    const sx = (x - rect.left) / (scale || 1);
    const sy = (y - rect.top) / (scale || 1);

    const tx = bleed + w / 2 - sx * k;
    const ty = bleed + h / 2 - sy * k;
    stage.style.transform = `translate(${tx}px, ${ty}px) scale(${k})`;

    // The capsule tracks the pointer but stays on screen. Moving the box never lies
    // about what's magnified — the content stays centred on the sample regardless.
    const bx = clampTo(x, w / 2 + 4, window.innerWidth - w / 2 - 4);
    let by = y + cur.offsetY;
    // Reading the first line of a page would push the capsule off the top. Flip it to
    // the other side of the sample, as iOS does, rather than sliding it down over the
    // very text it's showing.
    if (by - h / 2 < 4) by = y - cur.offsetY;
    by = clampTo(by, h / 2 + 4, window.innerHeight - h / 2 - 4);
    // `translate` (not `transform`) so the CSS open/close animation owns `scale`.
    root.style.translate = `${Math.round(bx - w / 2)}px ${Math.round(by - h / 2)}px`;

    lastX = pointerX;
    lastY = pointerY;
    return { x, y, pointerX, pointerY, caret };
  };

  const show = (clientX: number, clientY: number): void => {
    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = 0;
    }
    if (!open) {
      // Snapshot on the way open only — a consumer driving the loupe from their own
      // pointermove would otherwise re-clone the source on every frame. Re-reading a
      // changed source is `refresh()`'s job.
      snapshot();
      open = true;
      if (canPopover) {
        // Re-showing an open popover throws; the guard above covers the normal
        // path, this catches a host that closed it out from under us.
        try {
          root.showPopover();
        } catch {
          /* already open */
        }
      } else {
        root.style.display = 'block';
      }
      alignClone(); // only measurable now that the loupe is no longer display:none
    }
    const sample = aim(clientX, clientY);
    root.classList.add('is-open'); // drives the non-popover fallback's transition
    o.onShow?.(sample);
  };

  const move = (clientX: number, clientY: number): void => {
    if (!open) return;
    // `o.onMove?.(aim(…))` would be a trap: an optional call short-circuits the whole
    // expression when the callback is missing, arguments included — so the loupe
    // would silently stop tracking the pointer for anyone who didn't pass onMove.
    const sample = aim(clientX, clientY);
    o.onMove?.(sample);
  };

  const hide = (): void => {
    if (!open) return;
    open = false;
    root.classList.remove('is-open');
    if (canPopover) root.hidePopover();
    else root.style.display = 'none';
    // Let the close animation play over the clone before dropping it.
    clearTimer = window.setTimeout(() => {
      clearTimer = 0;
      stage.replaceChildren();
    }, 300);
    o.onHide?.();
  };

  layout();

  // ── Built-in gestures ──
  // Everything here is optional sugar over show/move/hide: `trigger: 'none'` binds
  // nothing and hands the same three calls to the consumer.
  let pressTimer = 0;
  let downId = -1;
  let downX = 0;
  let downY = 0;
  let captured = -1;

  const cancelPress = (): void => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = 0;
    }
  };

  const releaseCapture = (): void => {
    if (captured >= 0) {
      try {
        source.releasePointerCapture(captured);
      } catch {
        /* pointer already gone */
      }
      captured = -1;
    }
  };

  // `user-select: none` is the one suppression that would cost a pointing-device user
  // something real — the ability to select text on the source at all — so it goes on
  // and off with the gesture instead of living on the element. The timing splits by
  // pointer type: on touch a drag scrolls rather than selects, so nothing is lost by
  // taking it at pointerdown; with a mouse a drag *is* a selection, so it waits until
  // the hold has actually won and turned into a loupe.
  let selectionHeld = false;
  const holdSelection = (): void => {
    if (!suppressNative || selectionHeld) return;
    selectionHeld = true;
    source.style.setProperty('-webkit-user-select', 'none');
    source.style.setProperty('user-select', 'none');
  };
  const freeSelection = (): void => {
    if (!selectionHeld) return;
    selectionHeld = false;
    source.style.removeProperty('-webkit-user-select');
    source.style.removeProperty('user-select');
  };

  const engage = (e: PointerEvent): void => {
    holdSelection();
    // A mouse hold may have dragged out a character or two on the way here. Leaving
    // that highlighted behind the loupe reads as a bug, so collapse it — but only if
    // it belongs to the source, never someone else's selection elsewhere on the page.
    const sel = document.getSelection();
    if (sel && !sel.isCollapsed && sel.anchorNode && source.contains(sel.anchorNode)) {
      sel.removeAllRanges();
    }
    // Capture so the loupe keeps following even when the finger leaves the source.
    try {
      source.setPointerCapture(e.pointerId);
      captured = e.pointerId;
    } catch {
      /* capture unavailable — moves still arrive while inside the source */
    }
    show(e.clientX, e.clientY);
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (!e.isPrimary || trigger === 'hover' || trigger === 'none') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    downId = e.pointerId;
    downX = e.clientX;
    downY = e.clientY;
    if (e.pointerType !== 'mouse') holdSelection();
    if (trigger === 'press') {
      engage(e);
      return;
    }
    // Read off `cur`, not a mount-time const, so reconfigure() retunes the hold.
    pressTimer = window.setTimeout(() => {
      pressTimer = 0;
      engage(e);
    }, cur.longPressMs);
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (trigger === 'hover') {
      if (e.pointerType === 'touch') return; // hover mode is a pointing-device affordance
      if (open) move(e.clientX, e.clientY);
      else show(e.clientX, e.clientY);
      return;
    }
    if (e.pointerId !== downId) return;
    if (pressTimer) {
      // Still counting down — a drag this early is a scroll or a selection, not a
      // press. Give the gesture back to the browser rather than just dropping the timer.
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > moveTolerance) {
        cancelPress();
        freeSelection();
      }
      return;
    }
    if (!open) return;
    e.preventDefault(); // we own the gesture now: no scroll, no native selection drag
    move(e.clientX, e.clientY);
  };

  const onPointerUp = (): void => {
    cancelPress();
    downId = -1;
    releaseCapture();
    freeSelection();
    if (trigger !== 'hover') hide();
  };

  const onPointerLeave = (): void => {
    if (trigger === 'hover') hide();
  };

  // Android fires contextmenu on long-press and would open the system menu over us.
  const onContextMenu = (e: Event): void => {
    if (open || pressTimer) e.preventDefault();
  };
  const onSelectStart = (e: Event): void => {
    if (open) e.preventDefault();
  };

  // The clone is a snapshot in source-local coordinates, so scrolling doesn't
  // invalidate it — only the source's viewport position moved. Re-aiming is enough.
  const onViewportChange = (): void => {
    if (open) aim(lastX, lastY);
  };

  const prevInline = source.getAttribute('style');
  if (suppressNative) {
    // Both of these are touch-only — neither changes anything for a mouse — so they
    // can sit on the element for the whole mount. They stop iOS Safari answering the
    // long-press with its own callout bar, and stop the touch turning into a scroll.
    source.style.setProperty('-webkit-touch-callout', 'none');
    source.style.setProperty('touch-action', 'none');
  }

  if (trigger !== 'none') {
    source.addEventListener('pointerdown', onPointerDown);
    source.addEventListener('pointermove', onPointerMove);
    source.addEventListener('pointerup', onPointerUp);
    source.addEventListener('pointercancel', onPointerUp);
    source.addEventListener('pointerleave', onPointerLeave);
    source.addEventListener('contextmenu', onContextMenu);
    source.addEventListener('selectstart', onSelectStart);
  }
  // Outside the trigger guard: an open loupe has to track the source whatever
  // opened it, including a `trigger: 'none'` one driven from consumer code.
  // Capture, so a scrolling ancestor counts and not just the document.
  window.addEventListener('scroll', onViewportChange, true);
  window.addEventListener('resize', onViewportChange);

  return {
    element: root,
    show,
    move,
    hide,
    isOpen: () => open,
    refresh() {
      if (!open) return;
      snapshot();
      alignClone();
      aim(lastX, lastY);
    },
    reconfigure(patch) {
      Object.assign(cur, patch);
      // layout() regenerates the displacement map, which is the expensive part.
      // zoom, offsetY and longPressMs don't touch it — they're applied by aim() or
      // read at pointerdown — so a tuner dragging those shouldn't pay for a rebuild.
      if (Object.keys(patch).some((k) => LAYOUT_KEYS.has(k))) layout();
      if (open) aim(lastX, lastY);
    },
    getOptions() {
      return { ...cur };
    },
    dispose() {
      cancelPress();
      releaseCapture();
      if (clearTimer) clearTimeout(clearTimer);
      if (open && canPopover) root.hidePopover();
      open = false;
      source.removeEventListener('pointerdown', onPointerDown);
      source.removeEventListener('pointermove', onPointerMove);
      source.removeEventListener('pointerup', onPointerUp);
      source.removeEventListener('pointercancel', onPointerUp);
      source.removeEventListener('pointerleave', onPointerLeave);
      source.removeEventListener('contextmenu', onContextMenu);
      source.removeEventListener('selectstart', onSelectStart);
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
      if (suppressNative) {
        if (prevInline == null) source.removeAttribute('style');
        else source.setAttribute('style', prevInline);
      }
      lens?.dispose();
      lens = null;
      root.remove();
    },
  };
}
