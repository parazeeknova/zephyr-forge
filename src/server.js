#!/usr/bin/env node

import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import fs from 'node:fs';
import cors from 'cors';
import os from 'node:os';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.NODE_ENV === 'production'
  ? '/app/data/stats.db'
  : join(__dirname, 'data', 'stats.db');

let db;
async function setupDatabase() {
  db = await open({
    filename: 'stats.db',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS stats (
      name TEXT PRIMARY KEY,
      value INTEGER DEFAULT 0
    )
  `);

  await db.run(`
    INSERT OR IGNORE INTO stats (name, value) VALUES ('unix_copy_count', 0)
  `);
  await db.run(`
    INSERT OR IGNORE INTO stats (name, value) VALUES ('windows_copy_count', 0)
  `);
  await db.run(`
  INSERT OR IGNORE INTO stats (name, value) VALUES ('npm_copy_count', 0)
  `);
}

setupDatabase().catch(console.error);

const CONFIG = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_PATH: process.env.DB_PATH || 'stats.db',
  SITE_URL: process.env.SITE_URL || 'https://development.zephyyrr.in',
  DOCS_URL: process.env.DOCS_URL || 'https://github.com/parazeeknova/zephyr',
  UNIX_SCRIPT: process.env.UNIX_SCRIPT || 'install.sh',
  WINDOWS_SCRIPT: process.env.WINDOWS_SCRIPT || 'install.ps1',
  RATE_LIMIT: {
    WINDOW_MS: Number.parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10),
    MAX_REQUESTS: Number.parseInt(process.env.RATE_LIMIT_MAX || '50', 10)
  },
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
};

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV === 'development';

if (isDev) {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });
}

app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "https://analytics-umami.zephyyrr.in",
        (req, res) => `'nonce-${res.locals.nonce}'`
      ],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        isDev ? 'http://localhost:*' : CONFIG.SITE_URL,
        "https://analytics-umami.zephyyrr.in"
      ],
      frameSrc: ["'self'", "https://analytics-umami.zephyyrr.in"],
      frameAncestors: ["'self'"],
    },
  },
  // Disable COEP, COOP, and CORP in both dev and prod for analytics to work
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false
}));

const limiter = rateLimit({
  windowMs: isDev ? 60 * 1000 : CONFIG.RATE_LIMIT.WINDOW_MS,
  max: isDev ? 100 : CONFIG.RATE_LIMIT.MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors({
  origin: CONFIG.CORS_ORIGIN,
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(limiter);
app.use(compression());
app.use(cors());

const logFormat = isDev ? 'dev' : 'combined';

const logsDir = join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const accessLogStream = fs.createWriteStream(
  join(logsDir, 'access.log'),
  { flags: 'a' }
);

app.use(morgan(logFormat, {
  stream: isDev ? process.stdout : accessLogStream
}));

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    API_BASE: '/api',
    STATUS_INTERVAL: 30000,
    COPY_TIMEOUT: 1000,
    TOAST_DURATION: 2000
  });
});

app.get(`/${CONFIG.UNIX_SCRIPT}`, (req, res) => {
  res.sendFile(join(__dirname, 'scripts', CONFIG.UNIX_SCRIPT));
});

app.get(`/${CONFIG.WINDOWS_SCRIPT}`, (req, res) => {
  res.sendFile(join(__dirname, 'scripts', CONFIG.WINDOWS_SCRIPT));
});

app.get('/api/status', async (req, res) => {
  try {
    const status = {
      status: 'operational',
      environment: CONFIG.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        percentage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
      },
      cpu: {
        load: os.loadavg(),
        cores: os.cpus().length
      }
    };
    res.json(status);
  } catch (error) {
    console.error('Status check failed:', error);
    res.status(500).json({
      status: 'error',
      message: isDev ? error.message : 'Internal server error'
    });
  }
});

app.post('/api/copy-count/:type', async (req, res) => {
  const typeMap = {
    'windows': 'windows_copy_count',
    'unix': 'unix_copy_count',
    'npm': 'npm_copy_count'
  };
  
  const type = typeMap[req.params.type];
  
  if (!type) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  try {
    await db.run("UPDATE stats SET value = value + 1 WHERE name = ?", type);
    const result = await db.get('SELECT value FROM stats WHERE name = ?', type);
    res.json({ count: result.value });
  } catch (error) {
    console.error('Error updating copy count:', error);
    res.status(500).json({ error: 'Failed to update copy count' });
  }
});

app.get('/api/copy-count/:type', async (req, res) => {
  const typeMap = {
    'windows': 'windows_copy_count',
    'unix': 'unix_copy_count',
    'npm': 'npm_copy_count'
  };
  
  const type = typeMap[req.params.type];
  
  if (!type) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  try {
    const result = await db.get('SELECT value FROM stats WHERE name = ?', type);
    res.json({ count: result.value });
  } catch (error) {
    console.error('Error getting copy count:', error);
    res.status(500).json({ error: 'Failed to get copy count' });
  }
});

app.use('/static', express.static(join(__dirname, 'public')));

app.get('/', (req, res) => {
  const envVars = {
    SITE_URL: CONFIG.SITE_URL,
    DOCS_URL: CONFIG.DOCS_URL,
    UNIX_SCRIPT: CONFIG.UNIX_SCRIPT,
    WINDOWS_SCRIPT: CONFIG.WINDOWS_SCRIPT,
    API_BASE: '/api'
  };

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>Zephyr Forge</title>
        <link rel="icon" href="https://raw.githubusercontent.com/parazeeknova/zephyr-forge/c1f0f00554f19058ae32e275c03fe2fc22648d03/src/public/forge.svg" type="image/svg+xml">
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="description" content="Official environment setup for Zephyr development">
        <meta property="og:title" content="Zephyr Environment Setup">
        <meta property="og:description" content="Configure your Zephyr development environment">
        <meta property="og:url" content="${CONFIG.SITE_URL}">
        <style>
          :root {
            --bg: #0c0c0c;
            --text: #c4c4c4;
            --prompt: #4ec9b0;
            --dim: #666666;
            --toast-bg: rgba(74, 74, 74, 0.9);
            --accent: #7aa2f7;
            --link: #4ec9b0;
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: "SF Mono", "Menlo", "Monaco", "Courier", monospace;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .terminal {
            text-align: center;
            width: 100%;
            max-width: 800px;
            padding: 2rem;
          }

          .logo-container {
            position: relative;
            cursor: pointer;
            display: inline-block;
            margin-bottom: 1.5rem;
            text-decoration: none;
            text-align: center;
          }

          .logo, .logo-hover {
            color: var(--text);
            white-space: pre;
            font-size: 0.8rem;
            line-height: 1.2;
            transition: opacity 0.3s ease-in-out;
            display: inline-block;
            text-align: center;
          }

          .logo-hover {
            position: absolute;
            top: 0;
            left: 0;
            opacity: 0;
            color: var(--accent);
          }

          .logo-container:hover .logo {
            opacity: 0;
          }

          .logo-container:hover .logo-hover {
            opacity: 1;
          }

          .typing-text {
            overflow: hidden;
            white-space: nowrap;
            margin: 0 auto;
            text-align: center;
            color: var(--dim);
          }

          .main-desc {
            font-size: 0.8rem;
            opacity: 0;
            animation: typing 2s steps(40, end) forwards;
          }

          .sub-desc {
            font-size: 0.75rem;
            opacity: 0;
            animation: typing 2s steps(40, end) forwards;
            animation-delay: 2s;
            margin-bottom: 2rem;
          }

          .commands {
            display: inline-block;
            text-align: left;
            width: 100%;
            max-width: 550px;
          }

          .command-line {
            margin: 0.4rem 0;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }

          .prompt {
            color: var(--prompt);
            font-size: 0.85rem;
            min-width: 1.5rem;
          }

          .command-wrapper {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(255, 255, 255, 0.05);
            padding: 0.3rem 0.4rem;
            border-radius: 3px;
            flex-grow: 1;
            min-width: 520px;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .command-wrapper:hover {
            background: rgba(255, 255, 255, 0.1);
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          }

          .command {
            font-size: 0.75rem;
            user-select: none;
            cursor: pointer;
            position: relative;
            padding-right: 1rem;
            transition: color 0.2s ease;
          }

          .command:hover {
            color: var(--accent);
          }

          .command::after {
            position: absolute;
            right: -1.5rem;
            top: 50%;
            transform: translateY(-50%);
            font-size: 0.8rem;
            opacity: 0;
            transition: opacity 0.2s ease;
          }

          .command-wrapper:hover .command::after {
            opacity: 0.7;
          }

          .command-wrapper.copied {
            background: rgba(78, 201, 176, 0.1);
          }

          .command-wrapper.copied .command {
            color: var(--accent);
          }

          .copy-button {
            background: none;
            border: none;
            color: var(--dim);
            font-family: inherit;
            font-size: 0.75rem;
            cursor: pointer;
            padding: 0.2rem 0.4rem;
            transition: all 0.2s;
            margin-left: 1rem;
            white-space: nowrap;
          }

          .copy-button:hover {
            color: var(--text);
          }

          .copy-button.copied {
            animation: pulse 0.5s ease-in-out;
          }

          .toast {
            position: fixed;
            bottom: 2rem;
            left: 50%;
            transform: translateX(-50%) translateY(150%);
            background: var(--toast-bg);
            color: var(--text);
            padding: 0.75rem 1.5rem;
            border-radius: 4px;
            font-size: 0.9rem;
            transition: transform 0.3s ease-in-out;
            z-index: 1000;
            display: none;
          }

          .toast.show {
            display: block;
            transform: translateX(-50%) translateY(0);
          }

          .disclaimer {
            margin-top: 2rem;
            text-align: left;
            font-size: 0.8rem;
            color: var(--dim);
            max-width: 550px;
            margin-left: auto;
            margin-right: auto;
            padding: 1rem;
            background: rgba(255, 255, 255, 0.02);
            border-radius: 4px;
          }

          .disclaimer-title {
            color: var(--prompt);
            margin-bottom: 0.5rem;
            font-weight: bold;
          }

          .disclaimer a {
            position: relative;
            padding-bottom: 2px;
          }

          .disclaimer a::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            width: 0;
            height: 1px;
            background: var(--link);
            transition: width 0.2s ease;
          }

          .disclaimer a:hover::after {
            width: 100%;
          }

          @keyframes typing {
            from {
              width: 0;
              opacity: 1;
            }
            to {
              width: 100%;
              opacity: 1;
            }
          }

          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }

          @media (max-width: 768px) {
            .terminal {
              padding: 1rem;
            }
            
            .logo, .logo-hover {
              font-size: 0.6rem;
            }
            
            .commands {
              max-width: 90%;
            }

            .command-wrapper {
              min-width: unset;
            }

            .disclaimer {
              margin: 2rem 0.5rem;
              font-size: 0.75rem;
            }

            .command {
              font-size: 0.7rem;
            }

            .copy-button {
              font-size: 0.7rem;
            }

            .typing-text {
              padding: 0 1rem;
            }
          }

          @media (max-width: 480px) {
            .terminal {
              padding: 0.5rem;
              width: 100%;
              max-width: 100%;
            }

            .commands {
              width: 100%;
              padding: 0 0.5rem;
            }

            .command-line {
              margin: 0.5rem 0;
              width: 100%;
            }

            .command-wrapper {
              min-width: unset;
              width: 100%;
              padding: 0.4rem;
            }

            .command {
              font-size: 0.65rem;
              padding-right: 0.5rem;
              overflow-x: auto;
              white-space: nowrap;
              scrollbar-width: none; /* Firefox */
              -ms-overflow-style: none; /* IE and Edge */
            }

            .command::-webkit-scrollbar {
              display: none; /* Chrome, Safari, Opera */
            }

            .copy-wrapper {
              display: flex;
              align-items: center;
              gap: 0.3rem;
              flex-shrink: 0;
            }

            .copy-button {
              font-size: 0.65rem;
              padding: 0.2rem 0.4rem;
            }

            .copy-count {
              font-size: 0.65rem;
            }

            .prompt {
              font-size: 0.7rem;
              min-width: 1rem;
            }

            .typing-text {
              font-size: 0.7rem;
              padding: 0 0.5rem;
              margin-bottom: 1rem;
            }

            .logo, .logo-hover {
              font-size: 0.45rem;
              transform: scale(0.9);
            }

            .status-indicator {
              font-size: 0.65rem;
              padding: 0.3rem 0.5rem;
              right: 0.5rem;
              top: 0.5rem;
            }

            .disclaimer {
              font-size: 0.65rem;
              padding: 0.75rem;
              margin: 1rem 0.5rem;
            }
          }
          .status-indicator {
            position: absolute;
            top: 1rem;
            right: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.75rem;
            color: var(--dim);
            padding: 0.5rem 0.75rem;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 3px;
            transition: all 0.3s ease;
          }

          .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--dim);
            transition: background-color 0.3s ease;
          }

          .status-dot.operational {
            background: #4ec9b0;
            box-shadow: 0 0 8px rgba(78, 201, 176, 0.5);
          }

          .status-dot.error {
            background: #f44747;
            box-shadow: 0 0 8px rgba(244, 71, 71, 0.5);
          }

          .status-indicator:hover {
            background: rgba(255, 255, 255, 0.1);
          }

          @media (max-width: 768px) {
            .status-indicator {
              top: 0.5rem;
              right: 0.5rem;
            }
          }

        .copy-wrapper {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .copy-count {
          font-size: 0.75rem;
          color: var(--dim);
          opacity: 0.8;
        }
        </style>
        <script>
          window.SERVER_CONFIG = {
            API_BASE: '/api',
            STATUS_INTERVAL: ${CONFIG.STATUS_INTERVAL || 30000},
            COPY_TIMEOUT: ${CONFIG.COPY_TIMEOUT || 1000},
            TOAST_DURATION: ${CONFIG.TOAST_DURATION || 2000}
          };
        </script>
      </head>
      <body>
        <div class="terminal">
        <div class="status-indicator">
          <span class="status-dot"></span>
          <span class="status-text">Checking status...</span>
        </div>
          <a href="https://development.zephyyrr.in" class="logo-container" target="_blank">
            <div class="logo">
███████╗███████╗██████╗ ██╗  ██╗██╗   ██╗██████╗ 
╚══███╔╝██╔════╝██╔══██╗██║  ██║╚██╗ ██╔╝██╔══██╗
  ███╔╝ █████╗  ██████╔╝███████║ ╚████╔╝ ██████╔╝
 ███╔╝  ██╔══╝  ██╔═══╝ ██╔══██║  ╚██╔╝  ██╔══██╗
███████╗███████╗██║     ██║  ██║   ██║   ██║  ██║
╚══════╝╚══════╝╚═╝     ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝</div>
            <div class="logo-hover">
███████╗ ██████╗ ██████╗  ██████╗ ███████╗
██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██╔════╝
█████╗  ██║   ██║██████╔╝██║  ███╗█████╗  
██╔══╝  ██║   ██║██╔══██╗██║   ██║██╔══╝  
██║     ╚██████╔╝██║  ██║╚██████╔╝███████╗
╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝</div>
          </a>
          
          <div class="typing-text sub-desc">Official installation script forge for the Zephyr development.</div>
          
          <div class="commands">
            <div class="command-line">
              <span class="prompt">!</span>
              <div class="command-wrapper" data-command="npm">
                <span class="command">npx @parazeeknova/zephyr-forge init</span>
                <div class="copy-wrapper">
                  <button class="copy-button">copy</button>
                </div>
              </div>
            </div>

            <div class="command-line">
              <span class="prompt">$</span>
              <div class="command-wrapper" data-command="unix">
                <span class="command">curl -fsSL https://forge.zephyyrr.in/${envVars.UNIX_SCRIPT} | bash</span>
                <div class="copy-wrapper">
                  <button class="copy-button">copy</button>
                </div>
              </div>
            </div>

            <div class="command-line">
              <span class="prompt">></span>
              <div class="command-wrapper" data-command="windows">
                <span class="command">irm https://forge.zephyyrr.in/${envVars.WINDOWS_SCRIPT} | iex</span>
                <div class="copy-wrapper">
                  <button class="copy-button">copy</button>
                </div>
              </div>
            </div>

            <div class="disclaimer">
              <div class="disclaimer-title">> ENVIRONMENT SETUP</div>
              This script configures your local development environment for Zephyr. 
              Please review the environment configuration before running the setup script. 
              For production environments, refer to our official documentation.
              <br><br>
              <span class="prompt">$</span> Environment docs: <a href="${envVars.DOCS_URL}" target="_blank">${envVars.DOCS_URL.replace('https://', '')}</a>
            </div>
          </div>
        </div>

        <div id="toast" class="toast"></div>
        <script defer 
        crossorigin="anonymous"
        nonce="${res.locals.nonce}" 
        src="https://analytics-umami.zephyyrr.in/script.js" 
        data-website-id="577ed5ec-6d5d-4d7c-b523-7072a403b8b0">
      </script>
        <script src="/static/installer.js"></script>
      </body>
    </html>
  `);
});

app.listen(CONFIG.PORT, () => {
  const message = isDev
    ? `
=============================================================================
                    ZEPHYR INSTALLER (DEVELOPMENT MODE)
=============================================================================

🚀 Server running at: http://localhost:${CONFIG.PORT}
🔧 Environment: ${CONFIG.NODE_ENV}
📝 Logging: Enabled (${logFormat} format)
🔒 Security: Development settings

=============================================================================`
    : `
=============================================================================
                    ZEPHYR INSTALLER (PRODUCTION MODE)
=============================================================================

✅ Server started successfully
🔒 Security: Production settings enabled
📝 Logging: Production mode (${logFormat})

=============================================================================`;

  console.log(message);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  db?.close()
    .then(() => {
      console.log('Database connections closed.');
      process.exit(0);
    })
    .catch(console.error);
});
