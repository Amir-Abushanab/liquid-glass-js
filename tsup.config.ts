import { defineConfig } from 'tsup';

// Three entries → three top-level chunks, so the code-split survives downstream:
//   index → SVG-first core (mountGlass + all SVG-path renderers). No WebGL/QR.
//   webgl → GlassGL (the WebGL escape hatch). Also lazy-imported by index at runtime.
//   qr    → the Glass QR (the only thing that references `qrcode`, kept external).
// `splitting` factors shared deps (displacement.ts, qr/painting.ts) into their own
// chunks so nothing is duplicated across entries.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    webgl: 'src/webgl.ts',
    'qr/index': 'src/qr/index.ts',
  },
  format: ['esm'],
  target: 'es2020',
  dts: true,
  splitting: true,
  treeshake: true,
  sourcemap: true,
  clean: true,
  external: ['qrcode'],
});
