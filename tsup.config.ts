import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: false, // Disable source maps to reduce bundle size
  target: 'node18',
  minify: false,
  treeshake: true,
});


