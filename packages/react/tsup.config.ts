import { defineConfig } from 'tsup';

// react, its jsx-runtime, and @liquidglassjs/core stay external — this package
// ships only the wrapper glue and resolves them from the consumer's tree.
export default defineConfig({
  entry: { index: 'src/index.tsx' },
  format: ['esm'],
  target: 'es2020',
  dts: true,
  treeshake: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', 'react/jsx-runtime', '@liquidglassjs/core'],
});
