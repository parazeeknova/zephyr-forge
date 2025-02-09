import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { Database } from 'bun:sqlite';
import os from 'node:os';
import { env } from './env.js';

const app = new Hono();
const PORT = Number.parseInt(env.PORT || '3000');
const isDev = env.NODE_ENV === 'development';

app.use('*', async (c, next) => {
  c.req.raw.headers['x-forwarded-proto'] = 'https';
  return await next();
});

app.use(
  '*',
  cors({
    origin: ['http://localhost:3000', 'http://localhost:3456', 'https://forge.zephyyrr.in'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

app.use('*', logger());

app.use(
  '/*',
  serveStatic({
    root: './dist',
    rewriteRequestPath: (path) => {
      if (path === '/') return '/index.html';
      return path;
    },
  }),
);

app.get('*', async (c) => {
  try {
    const html = await Bun.file('/app/dist/index.html').text();
    return c.html(html);
  } catch (error) {
    console.error('Error serving index.html:', error);
    return c.text('Internal Server Error', 500);
  }
});

const DB_PATH = isDev ? './stats.db' : '/app/data/stats.db';

let db;

try {
  db = new Database(DB_PATH);

  db.run(`
    CREATE TABLE IF NOT EXISTS copy_stats (
      type TEXT PRIMARY KEY,
      count INTEGER DEFAULT 0
    )
  `);

  db.run('INSERT OR IGNORE INTO copy_stats (type, count) VALUES (?, 0)', ['npm']);

  console.log('Database initialized successfully at:', DB_PATH);
} catch (error) {
  console.error('Database initialization error:', error);
  process.exit(1);
}

if (!isDev) {
  try {
    await Bun.write('/app/data/.keep', '');
  } catch (error) {
    console.error('Failed to create data directory:', error);
  }
}

db.run(`
  CREATE TABLE IF NOT EXISTS copy_stats (
    type TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0
  )
`);

db.run('INSERT OR IGNORE INTO copy_stats (type, count) VALUES (?, 0)', ['npm']);

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: ['http://localhost:3000', 'https://forge.zephyyrr.in'],
    credentials: true,
  }),
);

app.use('/*', serveStatic({ root: './dist' }));

app.get('/api/status', (c) => {
  const status = {
    status: 'operational',
    environment: env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    system: {
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        percentage: (((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(2),
      },
      cpu: {
        load: os.loadavg(),
        cores: os.cpus().length,
      },
    },
  };
  return c.json(status);
});

app.get('/api/copy-count', async (c) => {
  try {
    const result = db.prepare('SELECT count FROM copy_stats WHERE type = ?').get('npm');
    return c.json({ count: result?.count || 0 });
  } catch (error) {
    console.error('Error getting copy count:', error);
    return c.json({ error: 'Failed to get copy count' }, 500);
  }
});

app.post('/api/copy-count', async (c) => {
  try {
    db.prepare('UPDATE copy_stats SET count = count + 1 WHERE type = ?').run('npm');

    const result = db.prepare('SELECT count FROM copy_stats WHERE type = ?').get('npm');

    return c.json({ count: result?.count || 0 });
  } catch (error) {
    console.error('Error updating copy count:', error);
    return c.json({ error: 'Failed to update copy count' }, 500);
  }
});

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

serve(
  {
    fetch: app.fetch,
    port: PORT,
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
💾 Database: Connected

=============================================================================
  `);
  },
);

const shutdown = () => {
  console.log('\nShutting down gracefully...');
  db.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
