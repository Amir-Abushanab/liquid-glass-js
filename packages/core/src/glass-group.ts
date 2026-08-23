// Merged glass — several elements sharing ONE displacement map whose SDFs fuse
// by smooth-min: Apple's droplet merge (GlassEffectContainer's spacing), in SVG.
//
// Composition: the group only decides WHAT the map is — the measured items'
// rounded rects, smin-fused by group-map.ts — and hands it to
// createGlassSurface via its buildMap hook. Everything the morphs already
// solved (the chroma filter chain, Safari's id cache, map decode timing,
// setDisplScale) is the surface's, unchanged.
//
// Geometry: the refract pane (`target`) is the live DOM that bends; the items
// are chrome ABOVE it — a label, a hairline — and are never filtered
// themselves. That placement is load-bearing in Safari: a transform sliding an
// item never trips the composited-child-escapes-the-filter rule, because the
// moving element isn't in the filtered subtree. Items are measured by
// getBoundingClientRect against the target's rect, transforms INCLUDED —
// deliberately unlike mount.ts's layoutBox (which wants the untransformed box
// of the glass root itself): a pill mid-slide should merge from where it IS.
//
// update() re-measures and re-encodes the map. That is the honest cost of a
// merge: the neck between two approaching shapes changes shape, so no
// cheap-attribute trick can express it (the one place a GPU SDF evaluator is
// structurally ahead of a baked map). group-map only computes the union bbox
// plus a fuse apron, so a drag regen is ~1–3ms at control sizes; call
// update() from the gesture that moves an item, and let the ResizeObserver
// cover layout-driven movement.

import {
  createGlassSurface,
  GLASS_SURFACE_DEFAULTS,
  type GlassSurface,
  type GlassSurfaceParams,
} from './glass-morph';
import { buildGroupDisplacementMap, type GroupShape } from './group-map';

/** Live-tunable group params: the surface's (minus dome — a union has no centre), plus the fuse. */
export interface GlassGroupParams extends Omit<GlassSurfaceParams, 'dome'> {
  /** Smooth-min k, px — silhouettes bridge at a gap of about k/2 (see group-map). */
  blend: number;
  /**
   * Dark occlusion rim opposite the glint (0–1, default 0). Baked into the
   * map's B channel, so it follows a fused neck — the map-driven stand-in for
   * the inset-shadow chrome a single element would carry.
   */
  shade: number;
  /**
   * Light angle in degrees (default 45). A map input — quantize before tying
   * it to pointer/orientation. When the light rides the same gesture that
   * moves an item, fold it into that gesture's update instead of a second
   * reconfigure: the regen is shared.
   */
  specularRotation: number;
}

export interface GlassGroupOptions extends Partial<GlassGroupParams> {
  /** The live pane that bends (receives filter:url()). */
  target: HTMLElement;
  /** Where the hidden <svg><filter> lives. */
  host: HTMLElement;
  /**
   * The glass elements, measured against `target`'s box (transforms included —
   * a sliding pill merges from where it is), or a callback returning explicit
   * shapes in target coordinates for fully synthetic groups.
   */
  items: HTMLElement[] | (() => GroupShape[]);
  active?: boolean;
}

export interface GlassGroup {
  /** Re-measure the items and re-encode the map (rAF-coalesced; no-op when nothing moved). */
  update(): void;
  reconfigure(patch: Partial<GlassGroupParams>): void;
  /** Cheap per-frame refraction fade/boost — see GlassSurface.setDisplScale. */
  setDisplScale(frac: number): void;
  whenReady(): Promise<void>;
  setActive(on: boolean): void;
  getOptions(): GlassGroupParams;
  dispose(): void;
}

const DEFAULT_BLEND = 24;

export function mountGlassGroup(o: GlassGroupOptions): GlassGroup {
  let blend = o.blend ?? DEFAULT_BLEND;
  let shapes: GroupShape[] = [];
  let lastKey = '';
  let raf = 0;

  const measure = (): { w: number; h: number; shapes: GroupShape[] } => {
    const tb = o.target.getBoundingClientRect();
    const next =
      typeof o.items === 'function'
        ? o.items()
        : o.items.map((el) => {
            const r = el.getBoundingClientRect();
            return {
              x: r.left - tb.left,
              y: r.top - tb.top,
              w: r.width,
              h: r.height,
              r:
                parseFloat(getComputedStyle(el).borderTopLeftRadius) ||
                Math.min(r.width, r.height) / 2,
            };
          });
    return {
      w: Math.max(1, Math.round(tb.width)),
      h: Math.max(1, Math.round(tb.height)),
      shapes: next,
    };
  };

  // Compare at half-px precision: finer differences don't survive the 8-bit
  // map anyway, and skipping them skips a full re-encode.
  const keyOf = (m: { w: number; h: number; shapes: GroupShape[] }) =>
    `${m.w}x${m.h}|${m.shapes
      .map((s) => [s.x, s.y, s.w, s.h, s.r].map((v) => Math.round(v * 2)).join(','))
      .join(';')}|${blend}`;

  const first = measure();
  shapes = first.shapes;
  lastKey = keyOf(first);

  // The map inputs, kept here rather than read back from the surface: the
  // surface calls buildMap synchronously while it is still constructing, so
  // the hook can't reach through the instance binding.
  const mapP = {
    depth: o.depth ?? GLASS_SURFACE_DEFAULTS.depth,
    profile: o.profile ?? GLASS_SURFACE_DEFAULTS.profile,
    edge: o.edge ?? GLASS_SURFACE_DEFAULTS.edge,
    glow: o.glow ?? GLASS_SURFACE_DEFAULTS.glow,
    shade: o.shade ?? 0,
    specularRotation: o.specularRotation ?? 45,
  };

  const surface: GlassSurface = createGlassSurface({
    host: o.host,
    target: o.target,
    width: first.w,
    height: first.h,
    radius: 0,
    dome: 0,
    depth: o.depth,
    profile: o.profile,
    edge: o.edge,
    glow: o.glow,
    strength: o.strength,
    chroma: o.chroma,
    blur: o.blur,
    spec: o.spec,
    active: o.active,
    buildMap: (w, h) =>
      buildGroupDisplacementMap({
        width: w,
        height: h,
        shapes,
        blend,
        depth: mapP.depth,
        profile: mapP.profile,
        edge: mapP.edge,
        glow: mapP.glow,
        shade: mapP.shade,
        specularRotation: mapP.specularRotation,
      }),
  });

  const run = () => {
    raf = 0;
    const m = measure();
    const key = keyOf(m);
    if (key === lastKey) return;
    lastKey = key;
    shapes = m.shapes;
    surface.regenerate(m.w, m.h, 0);
  };
  const update = () => {
    if (raf) return;
    raf = requestAnimationFrame(run);
  };

  const ro = new ResizeObserver(update);
  ro.observe(o.target);
  if (Array.isArray(o.items)) for (const el of o.items) ro.observe(el);

  return {
    update,
    reconfigure(patch) {
      const { blend: nextBlend, shade: nextShade, specularRotation: nextRot, ...rest } = patch;
      const blendChanged = typeof nextBlend === 'number' && nextBlend !== blend;
      if (blendChanged) blend = nextBlend;
      const shadeChanged = typeof nextShade === 'number' && nextShade !== mapP.shade;
      if (shadeChanged) mapP.shade = nextShade;
      const rotChanged = typeof nextRot === 'number' && nextRot !== mapP.specularRotation;
      if (rotChanged) mapP.specularRotation = nextRot;
      if (rest.depth != null) mapP.depth = rest.depth;
      if (rest.profile != null) mapP.profile = rest.profile;
      if (rest.edge != null) mapP.edge = rest.edge;
      if (rest.glow != null) mapP.glow = rest.glow;
      // Surface rebuilds for its own map keys (depth/profile/edge/glow); the
      // group-only keys (blend, shade) re-run the same wiring by hand.
      surface.reconfigure(rest);
      if (
        (blendChanged || shadeChanged || rotChanged) &&
        !['depth', 'profile', 'edge', 'glow'].some((k) => k in rest)
      ) {
        lastKey = ''; // the key embeds only geometry — force the next run through
        update();
      }
    },
    setDisplScale: (f) => surface.setDisplScale(f),
    whenReady: () => surface.whenReady(),
    setActive: (on) => surface.setActive(on),
    getOptions() {
      const { dome: _dome, ...p } = surface.getOptions();
      return { ...p, blend, shade: mapP.shade, specularRotation: mapP.specularRotation };
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      surface.dispose();
    },
  };
}
