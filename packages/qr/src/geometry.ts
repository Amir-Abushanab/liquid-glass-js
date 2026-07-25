// QR geometry for the Glass QR — exact port of Aave's useMemo builder
// (bundle fc9f28cb 1742-1806), backed by the real `qrcode` library.
//
// Produces everything the WebGL renderer needs to draw the code procedurally:
//   • occupancy: N×N R8 mask (255 = a dot is present in that module)
//   • eyes: the 3 finder patterns, each as 3 concentric rounded rects
//   • dots / matrixLength / gridOriginUV / cellUV / dotRadius
// The 3 finder corners and the centre logo region are punched out of the dots.

import QRCode from 'qrcode';
import { EC_RADIUS } from './painting';

export interface Eye {
  fill: string;
  rx: number;
  ry: number;
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface QRGeometry {
  dots: { x: number; y: number; r: number }[];
  eyes: Eye[];
  occupancy: Uint8Array;
  matrixLength: number;
  gridOriginUV: number;
  cellUV: number;
  /** Module half-extent in UV: a dot's radius, or a square module's half-width. */
  dotRadius: number;
}

export interface QRGeometryOptions {
  size: number;
  value: string;
  /** Punch a logo-sized hole in the encoded modules. Default true. */
  reserveCenter?: boolean;
  /** @deprecated Renamed to `reserveCenter`. */
  image?: boolean;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  /**
   * How much of its cell a module fills, 0…1. Default {@link DEFAULT_MODULE_SCALE}
   * (≈0.7) — the classic gapped dots; `1` makes neighbours touch.
   */
  moduleScale?: number;
  /**
   * Finder-eye corner radius as a fraction of each ring's half-size, 0 (sharp
   * squares) … 1 (circles). Unset keeps the classic radii.
   */
  eyeRadius?: number;
}

/** The classic module footprint: `cell / 2.85` as a radius, i.e. ~70% of the cell. */
export const DEFAULT_MODULE_SCALE = 2 / 2.85;

/**
 * The classic finder-eye corner radii — outer, middle, inner — in px, and (like
 * Aave's original) NOT scaled by `size`: they step by ~one cell at the default
 * 300px, which is what keeps the three rings' corners looking parallel there.
 * `eyeRadius` opts into proportional radii instead, which do scale.
 */
const CLASSIC_EYE_RADII = [22, 13, 3];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function buildQRGeometry({
  size,
  value,
  reserveCenter,
  image,
  errorCorrectionLevel = 'Q',
  moduleScale,
  eyeRadius,
}: QRGeometryOptions): QRGeometry {
  const reserve = reserveCenter ?? image ?? true;
  const inner = size - 20; // 10px quiet-zone padding each side
  const dots: QRGeometry['dots'] = [];
  const eyes: Eye[] = [];

  const ec = errorCorrectionLevel ?? 'L';
  const flat = Array.prototype.slice.call(
    QRCode.create(value, { errorCorrectionLevel: ec }).modules.data,
    0,
  );
  const n = Math.sqrt(flat.length);
  // flat row-major → matrix[row][col]
  const matrix: number[][] = flat.reduce((acc: number[][], bit: number, idx: number) => {
    if (idx % n === 0) acc.push([bit]);
    else acc[acc.length - 1].push(bit);
    return acc;
  }, []);

  const cell = inner / matrix.length;
  const N = matrix.length;
  const occupancy = new Uint8Array(N * N);
  const ecFrac = errorCorrectionLevel ? EC_RADIUS[errorCorrectionLevel] : 0;
  const logoPx = reserve ? ecFrac * inner : 0;

  // 3 finder eyes — top-left, top-right, bottom-left.
  const eyeR = eyeRadius == null ? null : clamp01(eyeRadius);
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ].forEach(({ x, y }) => {
    const ox = (matrix.length - 7) * cell * x + 10;
    const oy = (matrix.length - 7) * cell * y + 10;
    for (let e = 0; e < 3; e++) {
      const ringSize = cell * (7 - 2 * e);
      const r = eyeR == null ? CLASSIC_EYE_RADII[e] : (eyeR * ringSize) / 2;
      eyes.push({
        fill: e % 2 !== 0 ? 'white' : 'black',
        rx: r,
        ry: r,
        width: ringSize,
        height: ringSize,
        x: ox + cell * e,
        y: oy + cell * e,
      });
    }
  });

  // Logo punch-out region, in modules.
  const logoModules = Math.floor((1.5 * logoPx) / cell);
  const lo = matrix.length / 2 - logoModules / 2;
  const hi = matrix.length / 2 + logoModules / 2 - 1;

  // Half-extent of one module: the circle's radius at the default `moduleRadius`,
  // and the half-width of the rounded box the shader draws at any other.
  const half = (cell * clamp01(moduleScale ?? DEFAULT_MODULE_SCALE)) / 2;

  matrix.forEach((row, t) => {
    row.forEach((bit, r) => {
      const inFinder =
        (t < 7 && r < 7) || (t > matrix.length - 8 && r < 7) || (t < 7 && r > matrix.length - 8);
      const inLogo = !!logoPx && t > lo && t < hi && r > lo && r < hi;
      if (!bit || inFinder || inLogo) return;
      dots.push({ x: t * cell + cell / 2 + 10, y: r * cell + cell / 2 + 10, r: half });
      occupancy[r * N + t] = 255;
    });
  });

  return {
    dots,
    eyes,
    occupancy,
    matrixLength: N,
    gridOriginUV: 10 / size,
    cellUV: cell / size,
    dotRadius: half / size,
  };
}
