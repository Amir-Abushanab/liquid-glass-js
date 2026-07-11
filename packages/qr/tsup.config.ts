import { defineConfig } from 'tsup';

// Single entry — the Glass QR. `qrcode` (npm) and @liquidglassjs/core are kept
// external, so this package ships only its own code and resolves both at runtime
// from the consumer's tree (core stays a single shared instance).
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  target: 'es2020',
  dts: true,
  splitting: true,
  treeshake: true,
  sourcemap: true,
  clean: true,
  external: ['qrcode', '@liquidglassjs/core'],
});
