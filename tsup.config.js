import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.js'],
  format: ['esm'],
  clean: true,
  minify: true,
  target: 'node18',
  outDir: 'dist/cli',
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  platform: 'node',
  splitting: false,
  sourcemap: false,
  dts: false,
});
