import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: './src',
  publicDir: '../public',

  server: {
    port: 3456,
    host: true,
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
    manifest: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
      },
      output: {
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name.split('.').pop();
          const type =
            {
              css: 'styles',
              js: 'scripts',
              png: 'images',
              jpg: 'images',
              jpeg: 'images',
              gif: 'images',
              svg: 'images',
              webp: 'images',
              woff: 'fonts',
              woff2: 'fonts',
              ttf: 'fonts',
              eot: 'fonts',
              txt: 'assets',
              ico: 'images',
            }[extType] || 'misc';

          const fileName = `assets/${type}/[name]-[hash][extname]`;
          console.log(`Building asset: ${fileName}`);
          return fileName;
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
    devSourcemap: true,
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@assets': resolve(__dirname, './src/assets'),
      '@lib': resolve(__dirname, './src/lib'),
    },
  },

  // Optimize deps
  optimizeDeps: {
    include: [], // Add any dependencies that need pre-bundling
    exclude: [], // Add any dependencies to exclude from pre-bundling
  },
  appType: 'spa',
  esbuild: {
    target: 'esnext',
    minify: true,
    legalComments: 'none',
  },
  preview: {
    port: 3456,
    host: true,
  },
});
