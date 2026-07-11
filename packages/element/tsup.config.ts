import { defineConfig } from 'tsup';

// @liquidglassjs/core stays external so it's a single shared instance in the
// consumer's tree. Registration is a side effect (see package.json sideEffects).
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  target: 'es2020',
  dts: true,
  treeshake: true,
  sourcemap: true,
  clean: true,
  external: ['@liquidglassjs/core'],
});
