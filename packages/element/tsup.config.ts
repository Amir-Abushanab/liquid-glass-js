import { defineConfig } from 'tsup';

// @liquidglassjs/core stays external so it's a single shared instance in the
// consumer's tree. Registration is a side effect (see package.json sideEffects).
//
// Two entries, two top-level chunks: <liquid-glass> and the opt-in <glass-loupe>,
// so importing one never drags in the other.
export default defineConfig({
  entry: { index: 'src/index.ts', loupe: 'src/loupe.ts' },
  format: ['esm'],
  target: 'es2020',
  dts: true,
  treeshake: true,
  sourcemap: true,
  clean: true,
  external: ['@liquidglassjs/core'],
});
