import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { Database } from 'bun:sqlite';
import os from 'node:os';
import { env } from './env.js';

const app = new Hono();
const PORT = Number.parseInt(env.PORT || '3456');
const HOST = env.HOST || '0.0.0.0';
const isDev = env.NODE_ENV === 'development';

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: ['http://localhost:3456', 'https://forge.zephyyrr.in'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

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

app.get('/api/copy-count/:type', async (c) => {
  try {
    const type = c.req.param('type');
    const result = db.prepare('SELECT count FROM copy_stats WHERE type = ?').get(type);
    return c.json({ count: result?.count || 0 });
  } catch (error) {
    console.error('Error getting copy count:', error);
    return c.json({ error: 'Failed to get copy count' }, 500);
  }
});

app.post('/api/copy-count/:type', async (c) => {
  try {
    const type = c.req.param('type');
    db.prepare('INSERT OR IGNORE INTO copy_stats (type, count) VALUES (?, 0)').run(type);
    db.prepare('UPDATE copy_stats SET count = count + 1 WHERE type = ?').run(type);
    const result = db.prepare('SELECT count FROM copy_stats WHERE type = ?').get(type);
    return c.json({ count: result?.count || 0 });
  } catch (error) {
    console.error('Error updating copy count:', error);
    return c.json({ error: 'Failed to update copy count' }, 500);
  }
});

app.use(
  '/assets/*',
  serveStatic({
    root: './dist',
    rewriteRequestPath: (path) => path,
    middleware: async (ctx, next) => {
      const ext = path.extname(ctx.req.url);
      switch (ext) {
        case '.js':
          ctx.res.headers.set('Content-Type', 'application/javascript');
          break;
        case '.css':
          ctx.res.headers.set('Content-Type', 'text/css');
          break;
        case '.svg':
          ctx.res.headers.set('Content-Type', 'image/svg+xml');
          break;
      }
      await next();
    },
  }),
);

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
  const types = ['npm', 'unix', 'windows'];
  types.forEach((type) => {
    db.run('INSERT OR IGNORE INTO copy_stats (type, count) VALUES (?, 0)', [type]);
  });
  console.log('Database initialized successfully at:', DB_PATH);
} catch (error) {
  console.error('Database initialization error:', error);
  process.exit(1);
}

app.use(
  '/*',
  serveStatic({
    root: '/app/dist',
    rewriteRequestPath: (path) => {
      if (path === '/') return '/index.html';
      return path;
    },
  }),
);

app.get('*', async (c) => {
  try {
    return c.html(await Bun.file('./dist/index.html').text());
  } catch (error) {
    console.error('Error serving index.html:', error);
    return c.text('Internal Server Error', 500);
  }
});

app.onError((err, c) => {
  console.error(`[${new Date().toISOString()}] Error:`, err);
  return c.json({ error: isDev ? err.message : 'Internal Server Error' }, 500);
});

serve(
  {
    fetch: app.fetch,
    port: PORT,
    hostname: HOST,
  },
  (info) => {
    console.log(`Server started on http://${HOST}:${PORT}`);
  },
);

const shutdown = () => {
  console.log('\nShutting down gracefully...');
  db.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
