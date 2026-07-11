import { defineConfig } from 'tsup';

// Two entries → two top-level chunks, so the code-split survives downstream:
//   index → SVG-first core (mountGlass + all SVG-path renderers). No WebGL.
//   webgl → GlassGL (the WebGL escape hatch). Also lazy-imported by index at runtime.
// `splitting` factors shared modules (displacement.ts, color.ts, …) into their own
// chunks so nothing is duplicated across entries. The Glass QR now lives in its own
// package (@liquidglassjs/qr) — which is why `qrcode` is no longer a dependency here.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    webgl: 'src/webgl.ts',
  },
  format: ['esm'],
  target: 'es2020',
  dts: true,
  splitting: true,
  treeshake: true,
  sourcemap: true,
  clean: true,
});
