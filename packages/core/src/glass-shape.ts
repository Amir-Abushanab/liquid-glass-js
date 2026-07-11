// Liquid glass from ANY alpha coverage — an inline SVG mark, an <img>, a
// <canvas>, or a raw draw callback. Same engine as the glass typeface
// (glyph-map's buildAlphaDisplacementMap + the shared mountAlphaGlass core);
// only the rasterization differs. The displacement map is shaped like the
// source's opaque pixels, and the filter clips to the target's SourceAlpha, so
// the glass traces the artwork's silhouette (item 1 — the headline feature).

import { buildAlphaDisplacementMap } from './glyph-map';
import { mountAlphaGlass, type AlphaGlass, type AlphaGlassParams } from './mount-alpha-glass';

export type GlassShapeParams = AlphaGlassParams;

export const GLASS_SHAPE_DEFAULTS: GlassShapeParams = {
  strength: 8,
  chroma: 0.4,
  blur: 0.3,
  bevel: 2.5,
  dome: 4,
  edge: 0.9,
  glow: 0.35,
  shade: 0,
};

const PARAM_KEYS = [
  'strength',
  'chroma',
  'blur',
  'bevel',
  'dome',
  'edge',
  'glow',
  'shade',
] as const;

// Where the shape's alpha comes from. A url/HTMLImageElement is decoded; an
// inline SVG is serialized to an image; a canvas is blitted directly; or supply
// a `draw` callback for anything else.
export type GlassShapeSource = HTMLImageElement | HTMLCanvasElement | SVGSVGElement | string;

export interface GlassShapeOptions extends Partial<GlassShapeParams> {
  target: HTMLElement; // element that receives filter:url() — its SourceAlpha clips the glass
  host: HTMLElement; // where the <svg><filter> holder is appended
  source?: GlassShapeSource; // image / canvas / inline SVG / url → the map's shape
  /** Escape hatch: paint opaque coverage yourself, in CSS px within the rect. */
  draw?: (ctx: CanvasRenderingContext2D, rectW: number, rectH: number) => void;
  glint?: string; // CSS colour for the specular glint (default white)
}

export type GlassShape = AlphaGlass;

interface ShapeMeasured {
  rectW: number;
  rectH: number;
}

export function mountGlassShape(o: GlassShapeOptions): GlassShape {
  const explicit: Partial<GlassShapeParams> = {};
  PARAM_KEYS.forEach((k) => {
    if (o[k] != null) explicit[k] = o[k];
  });
  const params: GlassShapeParams = { ...GLASS_SHAPE_DEFAULTS, ...explicit };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Resolve the source to something drawImage-able (or leave the raw `draw`).
  let bitmap: CanvasImageSource | null = null;
  const decode = async (): Promise<void> => {
    if (o.draw) return; // raw draw closure — nothing to decode
    const src = o.source;
    if (!src) return;
    if (typeof src === 'string' || src instanceof HTMLImageElement) {
      const img = typeof src === 'string' ? new Image() : src;
      if (typeof src === 'string') {
        img.crossOrigin = 'anonymous'; // best-effort CORS so the canvas isn't tainted
        img.src = src;
      }
      await img.decode();
      bitmap = img;
    } else if (src instanceof HTMLCanvasElement) {
      bitmap = src;
    } else if (typeof SVGSVGElement !== 'undefined' && src instanceof SVGSVGElement) {
      // inline SVG → serialize → blob URL → image (external resources/fonts
      // inside the SVG won't load in this path; fine for icon/logo artwork)
      const svg = new XMLSerializer().serializeToString(src);
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        bitmap = img;
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  };

  const measure = (): ShapeMeasured | null => {
    const r = o.target.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { rectW: r.width, rectH: r.height };
  };

  return mountAlphaGlass<ShapeMeasured>({
    target: o.target,
    host: o.host,
    idPrefix: 'gshape-' + Math.random().toString(36).slice(2, 8),
    params,
    glint: o.glint,
    dpr,
    ready: decode,
    measure,
    buildMap: (mm, cur, cache) => {
      try {
        return buildAlphaDisplacementMap(
          {
            rectW: mm.rectW,
            rectH: mm.rectH,
            dpr,
            bevel: cur.bevel,
            dome: cur.dome,
            edge: cur.edge,
            glow: cur.glow,
            shade: cur.shade,
            marginBoost: 0, // shapes stretch to the rect; no ascent/descent bleed
            draw: (ctx, margin) => {
              if (o.draw) {
                ctx.save();
                ctx.translate(margin, margin); // hand the closure a rect-local origin
                o.draw(ctx, mm.rectW, mm.rectH);
                ctx.restore();
              } else if (bitmap) {
                ctx.drawImage(bitmap, margin, margin, mm.rectW, mm.rectH);
              }
            },
          },
          cache,
        );
      } catch {
        // A cross-origin source without CORS taints the canvas and getImageData
        // throws — leave the target unfiltered rather than crash.
        console.warn('mountGlassShape: source tainted the canvas (needs CORS); left unfiltered');
        return { url: '', margin: 0, cssW: 0, cssH: 0 };
      }
    },
  });
}
