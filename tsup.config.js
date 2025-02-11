import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'cli/index': 'src/cli/index.js',
    'cli/commands/setup': 'src/cli/commands/setup.js',
    'cli/commands/dev': 'src/cli/commands/dev.js',
    'lib/services': 'src/lib/services.js',
    'lib/docker': 'src/lib/docker.js',
    'lib/utils': 'src/lib/utils.js',
    'lib/ui': 'src/lib/ui.js',
    'lib/env': 'src/lib/env.js',
  },
  format: ['esm'],
  clean: true,
  minify: true,
  target: 'node18',
  outDir: 'dist/module',
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  platform: 'node',
  splitting: false,
  sourcemap: false,
  dts: false,
  external: [
    '@clack/prompts',
    'chalk',
    'figlet',
    'gradient-string',
    'boxen',
    'ora',
    'fs-extra',
    'docker-compose',
    'dockerode',
    'execa',
  ],
  assets: [
    {
      from: 'src/assets/**/*',
      to: 'assets',
    },
  ],
});
