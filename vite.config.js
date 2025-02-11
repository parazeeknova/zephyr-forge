import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: './src',
  publicDir: '../public',
  server: {
    port: 3456,
    proxy: {
      '/api': {
        target: 'http://localhost:3456',
        changeOrigin: true,
        secure: false,
      },
      '/docker': {
        target: 'http://localhost:2375',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
    sourcemap: false,
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
      },
      output: {
        assetFileNames: (assetInfo) => {
          const extType =
            {
              css: 'styles',
              js: 'scripts',
              png: 'images',
              jpg: 'images',
              svg: 'images',
              txt: 'assets',
            }[assetInfo.name.split('.').pop()] || 'misc';

          return `assets/${extType}/[name]-[hash][extname]`;
        },
        chunkFileNames: 'assets/scripts/[name]-[hash].js',
        entryFileNames: 'assets/scripts/[name]-[hash].js',
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "sass:math";`,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@assets': resolve(__dirname, './src/assets'),
      '@lib': resolve(__dirname, './src/lib'),
    },
  },
});
