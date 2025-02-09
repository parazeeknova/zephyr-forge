import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: './src',
  publicDir: '../public',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
