// Animated lens displacement map for the Glass QR — exact port of Aave's
// `generatePixelsOnly` generator (bundle fc9f28cb 2244-2308).
//
// Unlike the dome generator in ../displacement.ts, this is a *linear* SDF lens:
//   R = X-displacement, G = Y-displacement (linear in normalised position,
//       attenuated by an erf edge-falloff toward the lens interior)
//   B = directional glow/edge specular (neutral 128 when glow/edge are 0)
// Everything is computed on one quadrant (64×64) and mirrored into the full
// 128×128 RGBA buffer, so it's cheap enough to regenerate every animation frame
// as the lens blooms.

// Aave's erf: tanh(√π · x)
function erf(x: number): number {
  return Math.tanh(1.7724538509 * x);
}

export interface LensOptions {
  lensHalfWidth: number;
  lensHalfHeight: number;
  borderRadius: number;
  depth: number;
  sdfBoundary?: boolean;
  edgeFalloff?: boolean;
  specularRotation?: number; // degrees, default 45
  glowStrength?: number; // default 0
  glowSpread?: number; // default 1
  glowExponent?: number; // default 1.5
  edgeStrength?: number; // default 0
  edgeWidth?: number; // default 3
  edgeExponent?: number; // default 1.5
}

const SIZE = 128;
const HALF = 64;

export class LensGenerator {
  private canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  private imageData: ImageData | null = null;

  private ensure() {
    if (!this.canvas) {
      const c = document.createElement('canvas');
      c.width = SIZE;
      c.height = SIZE;
      this.canvas = c;
      this.ctx = c.getContext('2d');
      this.imageData = this.ctx!.createImageData(SIZE, SIZE);
    }
    return { canvas: this.canvas!, ctx: this.ctx!, imageData: this.imageData! };
  }

  /** Regenerate the lens map for the given size; returns the backing canvas. */
  generate(opts: LensOptions): HTMLCanvasElement | OffscreenCanvas {
    const { ctx, imageData, canvas } = this.ensure();
    const {
      lensHalfWidth: o,
      lensHalfHeight: a,
      borderRadius: s,
      depth: l,
      sdfBoundary: useSdf = true,
      edgeFalloff: useFalloff = true,
      specularRotation = 45,
      glowStrength = 0,
      glowSpread = 1,
      glowExponent = 1.5,
      edgeStrength = 0,
      edgeWidth = 3,
      edgeExponent = 1.5,
    } = opts;

    const y = imageData.data;
    const cornerR = Math.min(s, Math.min(o, a));
    const innerHalfW = Math.max(0, o - l);
    const innerHalfH = Math.max(0, a - l);
    const innerCornerR = Math.max(0, Math.min(s, Math.min(innerHalfW, innerHalfH)));
    const T = l > 0 ? 1 / (l * Math.SQRT2) : 1e6;
    const hasSpec = glowStrength > 0 || edgeStrength > 0;
    const rot = (specularRotation * Math.PI) / 180;
    const M = Math.cos(rot);
    const L = Math.sin(rot);
    const A = (1 - glowSpread) * Math.SQRT2;
    const b = glowSpread * Math.SQRT2;
    const U = b > 0.001 ? 1 / b : 0;
    const B = edgeWidth > 0 ? 1 / edgeWidth : 0;
    const stepX = (2 * o) / SIZE;
    const stepY = (2 * a) / SIZE;
    const invW = 1 / o;
    const invH = 1 / a;

    for (let e = 0; e < HALF; e++) {
      const mirrorRow = SIZE - 1 - e;
      const wy = -((e + 0.5) * stepY - a);
      const sdfYTerm = wy - a + cornerR;
      const falloffY = useFalloff ? wy - innerHalfH + innerCornerR : 0;
      const normY = wy * invH;
      const clampNormY = normY > 1 ? 1 : normY;

      for (let r = 0; r < HALF; r++) {
        const mirrorCol = SIZE - 1 - r;
        const wx = -((r + 0.5) * stepX - o);
        const sdfXTerm = wx - o + cornerR;
        const fx = sdfXTerm > 0 ? sdfXTerm : 0;
        const fy = sdfYTerm > 0 ? sdfYTerm : 0;
        const dist =
          Math.sqrt(fx * fx + fy * fy) +
          (sdfXTerm > sdfYTerm ? (sdfXTerm > 0 ? 0 : sdfXTerm) : sdfYTerm > 0 ? 0 : sdfYTerm) -
          cornerR;

        const iTL = (SIZE * e + r) * 4;
        const iTR = (SIZE * e + mirrorCol) * 4;
        const iBL = (SIZE * mirrorRow + r) * 4;
        const iBR = (SIZE * mirrorRow + mirrorCol) * 4;

        if (!useSdf || dist < 0) {
          const normX = wx * invW;
          const clampNormX = normX > 1 ? 1 : normX;

          let edgeFall: number;
          if (useFalloff) {
            const ex = wx - innerHalfW + innerCornerR;
            const rx = ex > 0 ? ex : 0;
            const ry = falloffY > 0 ? falloffY : 0;
            edgeFall =
              0.5 *
              (1 +
                erf(
                  (Math.sqrt(rx * rx + ry * ry) +
                    (ex > falloffY ? (ex > 0 ? 0 : ex) : falloffY > 0 ? 0 : falloffY) -
                    innerCornerR) *
                    T
                ));
          } else {
            edgeFall = 1;
          }

          const hX = 0.5 * clampNormX * edgeFall;
          const hY = 0.5 * clampNormY * edgeFall;
          const rPos = ((0.5 + hX) * 255 + 0.5) | 0;
          const rNeg = ((0.5 - hX) * 255 + 0.5) | 0;
          const gPos = ((0.5 + hY) * 255 + 0.5) | 0;
          const gNeg = ((0.5 - hY) * 255 + 0.5) | 0;

          let specA = 128;
          let specB = 128;
          if (hasSpec) {
            const n2 = clampNormX * M;
            const a2 = clampNormY * L;
            const sSum = n2 + a2;
            const sDif = n2 - a2;
            const h2 = sSum < 0 ? -sSum : sSum;
            const f2 = sDif < 0 ? -sDif : sDif;
            let m2 = 0;
            if (edgeStrength > 0) {
              m2 = dist < 0 ? 1 + dist * B : 0;
              if (m2 < 0) m2 = 0;
            }
            let gv = 0;
            let cv = 0;
            if (glowStrength > 0) {
              const tg = (h2 - A) * U;
              gv += glowStrength * Math.pow(tg < 0 ? 0 : tg > 1 ? 1 : tg, glowExponent) * edgeFall;
              const rg = (f2 - A) * U;
              cv += glowStrength * Math.pow(rg < 0 ? 0 : rg > 1 ? 1 : rg, glowExponent) * edgeFall;
            }
            if (edgeStrength > 0) {
              gv += edgeStrength * m2 * Math.pow(h2, edgeExponent);
              cv += edgeStrength * m2 * Math.pow(f2, edgeExponent);
            }
            if (gv > 1) gv = 1;
            if (cv > 1) cv = 1;
            specA = (127 * gv + 128 + 0.5) | 0;
            specB = (127 * cv + 128 + 0.5) | 0;
          }

          y[iTL] = rPos; y[iTL + 1] = gPos; y[iTL + 2] = specA; y[iTL + 3] = 255;
          y[iTR] = rNeg; y[iTR + 1] = gPos; y[iTR + 2] = specB; y[iTR + 3] = 255;
          y[iBL] = rPos; y[iBL + 1] = gNeg; y[iBL + 2] = specB; y[iBL + 3] = 255;
          y[iBR] = rNeg; y[iBR + 1] = gNeg; y[iBR + 2] = specA; y[iBR + 3] = 255;
        } else {
          y[iTL] = 128; y[iTL + 1] = 128; y[iTL + 2] = 128; y[iTL + 3] = 255;
          y[iTR] = 128; y[iTR + 1] = 128; y[iTR + 2] = 128; y[iTR + 3] = 255;
          y[iBL] = 128; y[iBL + 1] = 128; y[iBL + 2] = 128; y[iBL + 3] = 255;
          y[iBR] = 128; y[iBR + 1] = 128; y[iBR + 2] = 128; y[iBR + 3] = 255;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  dispose() {
    this.canvas = null;
    this.ctx = null;
    this.imageData = null;
  }
}
