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
}

export function buildQRGeometry({
  size,
  value,
  reserveCenter,
  image,
  errorCorrectionLevel = 'Q',
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
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ].forEach(({ x, y }) => {
    const ox = (matrix.length - 7) * cell * x + 10;
    const oy = (matrix.length - 7) * cell * y + 10;
    for (let e = 0; e < 3; e++) {
      eyes.push({
        fill: e % 2 !== 0 ? 'white' : 'black',
        rx: -((e - 2) * 10) + (e === 0 ? 2 : 3),
        ry: -((e - 2) * 10) + (e === 0 ? 2 : 3),
        width: cell * (7 - 2 * e),
        height: cell * (7 - 2 * e),
        x: ox + cell * e,
        y: oy + cell * e,
      });
    }
  });

  // Logo punch-out region, in modules.
  const logoModules = Math.floor((1.5 * logoPx) / cell);
  const lo = matrix.length / 2 - logoModules / 2;
  const hi = matrix.length / 2 + logoModules / 2 - 1;

  matrix.forEach((row, t) => {
    row.forEach((bit, r) => {
      const inFinder =
        (t < 7 && r < 7) || (t > matrix.length - 8 && r < 7) || (t < 7 && r > matrix.length - 8);
      const inLogo = !!logoPx && t > lo && t < hi && r > lo && r < hi;
      if (!bit || inFinder || inLogo) return;
      dots.push({ x: t * cell + cell / 2 + 10, y: r * cell + cell / 2 + 10, r: cell / 2.85 });
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
    dotRadius: cell / 2.85 / size,
  };
}
