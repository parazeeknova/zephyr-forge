import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.js'],
  format: ['esm'],
  clean: true,
  minify: true,
  target: 'node18',
  outDir: 'dist/cli',
  shims: true,
});
