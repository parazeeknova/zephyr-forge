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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV === 'development';

if (isDev) {
  console.log(`
🔧 Running in Development Mode
------------------------------------------
🌐 Server: http://localhost:${port}
📜 Scripts:
   - Install Script (Unix): http://localhost:${port}/install.sh
   - Install Script (Windows): http://localhost:${port}/install.ps1
🏥 Health Check: http://localhost:${port}/health
------------------------------------------
  `);
}

if (isDev) {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

const limiter = rateLimit({
  windowMs: isDev ? 1 * 60 * 1000 : 15 * 60 * 1000,
  max: isDev ? 100 : 50,
});

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

app.get('/install.sh', (req, res) => {
  res.sendFile(join(__dirname, 'scripts', 'install.sh'));
});

app.get('/install.ps1', (req, res) => {
  res.sendFile(join(__dirname, 'scripts', 'install.ps1'));
});

app.get('/api/status', async (req, res) => {
  try {
    const status = {
      status: 'operational',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
      },
      cpu: os.loadavg()[0]
    };
    res.json(status);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.use('/static', express.static(join(__dirname, 'public')));

app.get('/', (req, res) => {
  const envVars = {
    SITE_URL: process.env.SITE_URL || 'https://development.zephyyrr.in',
    DOCS_URL: process.env.DOCS_URL || 'https://github.com/parazeeknova/zephyr',
    UNIX_SCRIPT: process.env.UNIX_SCRIPT || 'setup.sh',
    WINDOWS_SCRIPT: process.env.WINDOWS_SCRIPT || 'setup.ps1'
  };

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Zephyr Installer</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
            text-align: center;  /* Added */
          }

          .logo, .logo-hover {
            color: var(--text);
            white-space: pre;
            font-size: 0.8rem;
            line-height: 1.2;
            transition: opacity 0.3s ease-in-out;
            display: inline-block;  /* Added */
            text-align: left;  /* Added */
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
            max-width: 500px;
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
            min-width: 380px;
            cursor: pointer;  /* Added */
            transition: all 0.2s ease;  /* Added */
          }

          .command-wrapper:hover {
            background: rgba(255, 255, 255, 0.1);
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          }

          .command {
            font-size: 0.75rem;
            user-select: none;
            cursor: pointer;  /* Added */
            position: relative;  /* Added */
            padding-right: 1rem;  /* Added */
            transition: color 0.2s ease;  /* Added */
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
            max-width: 500px;
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
              max-width: 100%;
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
            .logo, .logo-hover {
              font-size: 0.5rem;
            }

            .main-desc {
              font-size: 0.75rem;
            }

            .sub-desc {
              font-size: 0.7rem;
            }

            .command-wrapper {
              padding: 0.25rem 0.4rem;
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
        </style>
      </head>
      <body>
        <div class="terminal">
        <div class="status-indicator">
          <span class="status-dot"></span>
          <span class="status-text">Checking status...</span>
        </div>
          <a href="https://zephyr.yourdomain.com" class="logo-container" target="_blank">
            <div class="logo">
███████╗███████╗██████╗ ██╗  ██╗██╗   ██╗██████╗ 
╚══███╔╝██╔════╝██╔══██╗██║  ██║╚██╗ ██╔╝██╔══██╗
  ███╔╝ █████╗  ██████╔╝███████║ ╚████╔╝ ██████╔╝
 ███╔╝  ██╔══╝  ██╔═══╝ ██╔══██║  ╚██╔╝  ██╔══██╗
███████╗███████╗██║     ██║  ██║   ██║   ██║  ██║
╚══════╝╚══════╝╚═╝     ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝</div>
            <div class="logo-hover">
  ██████╗ ███████╗██╗   ██╗███████╗██╗  
  ██╔══██╗██╔════╝██║   ██║██╔════╝██║     
  ██║  ██║█████╗  ██║   ██║█████╗  ██║     
  ██║  ██║██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║    
  ██████╔╝███████╗ ╚████╔╝ ███████╗███████╗ 
  ╚═════╝ ╚══════╝  ╚═══╝  ╚══════╝╚══════╝</div>
          </a>
          
          <div class="typing-text sub-desc">Official installation script forge for the Zephyr development.</div>
          
          <div class="commands">
            <div class="command-line">
              <span class="prompt">$</span>
              <div class="command-wrapper" data-command="unix">
                <span class="command">curl -fsSL http://localhost:${port}/${envVars.UNIX_SCRIPT} | bash</span>
                <button class="copy-button">copy</button>
              </div>
            </div>

            <div class="command-line">
              <span class="prompt">></span>
              <div class="command-wrapper" data-command="windows">
                <span class="command">irm http://localhost:${port}/${envVars.WINDOWS_SCRIPT} | iex</span>
                <button class="copy-button">copy</button>
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
        <script src="/static/installer.js"></script>
      </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`
=============================================================================
                    ZEPHYR INSTALLER (DEVELOPMENT MODE)
=============================================================================

🚀 Server running at: http://localhost:${port}
🔧 Environment: ${process.env.NODE_ENV}
📝 Logging: Enabled (${logFormat} format)
🔒 Security: Development settings

=============================================================================`);
});
