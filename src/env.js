import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    PORT: z.string().default('3000'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    SITE_URL: z.string().url().default('https://development.zephyyrr.in'),
    DOCS_URL: z.string().url().default('https://github.com/parazeeknova/zephyr'),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
