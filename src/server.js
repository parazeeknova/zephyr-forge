import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { env } from './env.js';

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: ['http://localhost:3000', 'https://forge.zephyyrr.in'],
    credentials: true,
  }),
);

// Serve static files from public directory
app.use('/*', serveStatic({ root: './dist' }));

// API routes
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

let copyCount = 0;

app.post('/api/copy-count', async (c) => {
  copyCount++;
  return c.json({ count: copyCount });
});

// Error handling
app.onError((err, c) => {
  console.error(`[${new Date().toISOString()}] Error:`, err);
  return c.json(
    {
      error: env.NODE_ENV === 'development' ? err.message : 'Internal Server Error',
      status: 500,
    },
    500,
  );
});

// Start server
serve(
  {
    fetch: app.fetch,
    port: Number.parseInt(env.PORT),
  },
  (info) => {
    console.log(`
=============================================================================
                    ZEPHYR INSTALLER (${env.NODE_ENV.toUpperCase()})
=============================================================================

🚀 Server running at: http://localhost:${info.port}
🔧 Environment: ${env.NODE_ENV}
📝 Logging: Enabled
🔑 CORS: Enabled
🛠  API Base: /api

=============================================================================
  `);
  },
);

// Graceful shutdown
const shutdown = () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
