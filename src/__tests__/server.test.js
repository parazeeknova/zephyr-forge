import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { expect, test, describe, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

describe('Server API', () => {
    let app;
    let db;

    beforeAll(async () => {
        db = await open({
            filename: ':memory:',
            driver: sqlite3.Database
        });

        await db.exec(`
            CREATE TABLE stats (
              name TEXT PRIMARY KEY,
              value INTEGER DEFAULT 0
            )
          `);

        await db.run(`INSERT INTO stats (name, value) VALUES ('unix_copy_count', 0)`);
        await db.run(`INSERT INTO stats (name, value) VALUES ('windows_copy_count', 0)`);

        app = express();

        const CONFIG = {
            PORT: 3000,
            NODE_ENV: 'development',
            DB_PATH: ':memory:',
            SITE_URL: 'http://localhost:3000',
            DOCS_URL: 'http://localhost:3000/docs',
            UNIX_SCRIPT: 'install.sh',
            WINDOWS_SCRIPT: 'install.ps1',
            RATE_LIMIT: {
                WINDOW_MS: 1000,
                MAX_REQUESTS: 100
            },
            CORS_ORIGIN: '*'
        };

        app.use(helmet({
            contentSecurityPolicy: false,
            crossOriginEmbedderPolicy: false,
            crossOriginOpenerPolicy: false,
            crossOriginResourcePolicy: false
        }));

        app.use(cors({
            origin: CONFIG.CORS_ORIGIN,
            methods: ['GET', 'POST'],
            credentials: true
        }));

        const limiter = rateLimit({
            windowMs: CONFIG.RATE_LIMIT.WINDOW_MS,
            max: CONFIG.RATE_LIMIT.MAX_REQUESTS
        });

        app.use(limiter);
        app.use(compression());
        app.use(express.json());

        app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                environment: CONFIG.NODE_ENV,
                timestamp: new Date().toISOString()
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

        app.get('/api/status', (req, res) => {
            res.json({
                status: 'operational',
                environment: CONFIG.NODE_ENV,
                version: '1.0.0',
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
                memory: {
                    total: 1000000,
                    free: 500000,
                    used: 500000,
                    percentage: "50.00"
                },
                cpu: {
                    load: [0.1, 0.2, 0.3],
                    cores: 4
                }
            });
        });

        app.post('/api/copy-count/:type', async (req, res) => {
          const type = req.params.type;
          
          if (!['windows', 'unix'].includes(type)) {
            return res.status(400).json({ 
              error: 'Invalid type. Must be "windows" or "unix"' 
            });
          }

          const countField = type === 'windows' ? 'windows_copy_count' : 'unix_copy_count';

          try {
            await db.run(
              "UPDATE stats SET value = value + 1 WHERE name = ?",
              [countField]
            );
            const result = await db.get(
              "SELECT value FROM stats WHERE name = ?",
              [countField]
            );
            res.json({ count: result.value });
          } catch (error) {
            console.error('Database error:', error);
            res.status(500).json({ 
              error: 'Internal server error'
            });
          }
        });

        app.get('/api/copy-count/:type', async (req, res) => {
            const type = req.params.type === 'windows' ? 'windows_copy_count' : 'unix_copy_count';
            try {
                const result = await db.get('SELECT value FROM stats WHERE name = ?', type);
                res.json({ count: result.value });
            } catch (error) {
                console.error('Error getting copy count:', error);
                res.status(500).json({ error: 'Failed to get copy count' });
            }
        });

        const mockScriptContent = 'echo "Test Script"';
        jest.spyOn(path, 'join').mockImplementation((...args) => args.join('/'));
        jest.spyOn(express.static, 'send').mockImplementation((req, res) => {
            res.send(mockScriptContent);
        });

        app.get(`/${CONFIG.UNIX_SCRIPT}`, (req, res) => {
            res.type('application/x-sh').send(mockScriptContent);
        });

        app.get(`/${CONFIG.WINDOWS_SCRIPT}`, (req, res) => {
            res.type('application/octet-stream').send(mockScriptContent);
        });

        app.use('/static', express.static(path.join(__dirname, '..', 'public')));
    });

    afterAll(async () => {
        await db.close();
    });

    beforeEach(async () => {
        await db.run('DELETE FROM stats');
        await db.run(`INSERT INTO stats (name, value) VALUES ('unix_copy_count', 0)`);
        await db.run(`INSERT INTO stats (name, value) VALUES ('windows_copy_count', 0)`);
    });

    describe('Health Check', () => {
        test('GET /health returns healthy status', async () => {
            const response = await request(app).get('/health');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'healthy');
        });
    });

    describe('Copy Counter API', () => {
        test('POST /api/copy-count/unix increments unix counter', async () => {
            const response = await request(app)
                .post('/api/copy-count/unix');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('count', 1);
        });

        test('POST /api/copy-count/windows increments windows counter', async () => {
            const response = await request(app)
                .post('/api/copy-count/windows');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('count', 1);
        });

        test('GET /api/copy-count/unix returns current count', async () => {
            await db.run(`UPDATE stats SET value = 42 WHERE name = 'unix_copy_count'`);

            const response = await request(app)
                .get('/api/copy-count/unix');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('count', 42);
        });
    });

    describe('Status API', () => {
        test('GET /api/status returns system status', async () => {
            const response = await request(app)
                .get('/api/status');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'operational');
            expect(response.body).toHaveProperty('memory');
            expect(response.body).toHaveProperty('cpu');
        });
    });

    describe('Script Routes', () => {
        test('GET /install.sh serves unix script', async () => {
            const response = await request(app)
                .get('/install.sh');

            expect(response.status).toBe(200);
            expect(response.type).toBe('application/x-sh');
        });

        test('GET /install.ps1 serves windows script', async () => {
            const response = await request(app)
                .get('/install.ps1');

            expect(response.status).toBe(200);
            expect(response.type).toBe('application/octet-stream');
        });
    });
}); 
