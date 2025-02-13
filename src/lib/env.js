import { z } from 'zod';
import { createEnv } from '@t3-oss/env-core';
import fs from 'fs-extra';
import path from 'node:path';
import { select, text, isCancel, outro } from '@clack/prompts';
import ora from 'ora';
import chalk from 'chalk';
import boxen from 'boxen';

const serverSchema = {
  // Database
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  POSTGRES_DB: z.string().min(1),
  POSTGRES_PORT: z.string().default('5433'),
  POSTGRES_HOST: z.string().default('localhost'),
  DATABASE_URL: z.string(),
  POSTGRES_PRISMA_URL: z.string(),
  POSTGRES_URL_NON_POOLING: z.string(),

  // Redis
  REDIS_PASSWORD: z.string().min(1),
  REDIS_PORT: z.string().default('6379'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_URL: z.string(),

  // MinIO
  MINIO_ROOT_USER: z.string().min(1),
  MINIO_ROOT_PASSWORD: z.string().min(1),
  MINIO_BUCKET_NAME: z.string().default('uploads'),
  MINIO_PORT: z.string().default('9000'),
  MINIO_CONSOLE_PORT: z.string().default('9001'),
  MINIO_HOST: z.string(),
  MINIO_ENDPOINT: z.string(),
  NEXT_PUBLIC_MINIO_ENDPOINT: z.string(),
  MINIO_ENABLE_OBJECT_LOCKING: z.string(),

  // Application
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string(),
  NEXT_PUBLIC_PORT: z.string(),
  NEXT_PUBLIC_URL: z.string(),
  NEXT_PUBLIC_SITE_URL: z.string(),
  NODE_ENV: z.enum(['development', 'production']).default('development'),

  // Misc
  NEXT_TELEMETRY_DISABLED: z.string().optional(),
  TURBO_TELEMERY_DISABLED: z.string().optional(),
};

const DEFAULT_DB_ENV = `
# Database URLs for Prisma
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/zephyr
POSTGRES_PRISMA_URL=postgresql://postgres:postgres@localhost:5433/zephyr
POSTGRES_URL_NON_POOLING=postgresql://postgres:postgres@localhost:5433/zephyr

# Database Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=zephyr
POSTGRES_PORT=5433
POSTGRES_HOST=localhost
`.trim();

const DEFAULT_ENV_CONFIG = {
  REDIS_PASSWORD: 'zephyrredis',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  MINIO_HOST: 'localhost',
  MINIO_PORT: '9000',
  MINIO_ROOT_USER: 'minioadmin',
  MINIO_ROOT_PASSWORD: 'minioadmin',
  JWT_SECRET: 'zephyrjwtsupersecret',
};

export function getEnvSchema(runtimeEnv) {
  return createEnv({
    server: serverSchema,
    runtimeEnv,
  });
}

export async function createEnvFiles(projectRoot) {
  const envPaths = {
    web: path.join(projectRoot, 'apps/web/.env'),
    db: path.join(projectRoot, 'packages/db/.env'),
  };

  const existingEnvs = await checkExistingEnvFiles(envPaths);

  if (existingEnvs.length > 0) {
    return await handleExistingEnvFiles(projectRoot, envPaths, existingEnvs);
  }

  return await createNewEnvFiles(projectRoot, envPaths);
}

async function checkExistingEnvFiles(envPaths) {
  const existing = [];
  for (const [name, path] of Object.entries(envPaths)) {
    if (await fs.pathExists(path)) {
      existing.push(name);
    }
  }
  return existing;
}

async function handleExistingEnvFiles(projectRoot, envPaths, existingEnvs) {
  console.log(
    boxen(
      chalk.yellow(
        [
          'Existing environment files found!',
          '',
          ...existingEnvs.map((env) => `📄 ${env}/.env`),
          '',
          'Options:',
          '1. Overwrite - Replace with new configuration',
          '2. Backup & Create New - Save existing as .env.backup',
          '3. Keep Existing - Skip creating new env files',
        ].join('\n'),
      ),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'yellow',
      },
    ),
  );

  const action = await select({
    message: 'How would you like to handle existing env files?',
    options: [
      { value: 'overwrite', label: 'Overwrite', hint: 'Replace existing files' },
      { value: 'backup', label: 'Backup & Create New', hint: 'Save existing as .env.backup' },
      { value: 'keep', label: 'Keep Existing', hint: 'Skip creation' },
    ],
  });

  if (isCancel(action)) {
    outro(chalk.yellow('Operation cancelled'));
    process.exit(0);
  }

  const s = ora({ text: 'Processing environment files...', color: 'cyan' }).start();

  try {
    switch (action) {
      case 'overwrite':
        await createNewEnvFiles(projectRoot, envPaths);
        s.succeed('Environment files overwritten');
        break;

      case 'backup':
        for (const [name, path] of Object.entries(envPaths)) {
          if (await fs.pathExists(path)) {
            await fs.move(path, `${path}.backup`);
          }
        }
        await createNewEnvFiles(projectRoot, envPaths);
        s.succeed('Existing files backed up and new files created');
        break;

      case 'keep':
        s.succeed('Keeping existing environment files');
        break;
    }

    return { action, paths: envPaths };
  } catch (error) {
    s.fail(`Failed to process env files: ${error.message}`);
    throw error;
  }
}

async function createNewEnvFiles(projectRoot, envPaths) {
  const setupType = await select({
    message: 'How would you like to configure environment variables?',
    options: [
      { value: 'automatic', label: 'Automatic', hint: 'Use default development configuration' },
      { value: 'manual', label: 'Manual', hint: 'Configure each variable manually' },
    ],
  });

  if (isCancel(setupType)) {
    outro(chalk.yellow('Operation cancelled'));
    process.exit(0);
  }

  const s = ora({ text: 'Creating environment files...', color: 'cyan' }).start();

  try {
    let config = DEFAULT_ENV_CONFIG;

    if (setupType === 'manual') {
      config = await getManualConfig();
    }

    await fs.ensureDir(path.dirname(envPaths.web));
    await fs.ensureDir(path.dirname(envPaths.db));
    await fs.writeFile(envPaths.web, generateWebEnvContent(config));
    await fs.writeFile(envPaths.db, DEFAULT_DB_ENV);

    s.succeed('Environment files created successfully');
    return { type: setupType, paths: envPaths };
  } catch (error) {
    s.fail(`Failed to create environment files: ${error.message}`);
    throw error;
  }
}

async function getManualConfig() {
  console.log(chalk.blue('\nConfiguring environment variables:'));
  console.log(chalk.yellow('Press Enter to use default values\n'));

  const config = { ...DEFAULT_ENV_CONFIG };

  for (const [key, defaultValue] of Object.entries(config)) {
    if (serverSchema[key]) {
      const value = await text({
        message: `Enter ${key}:`,
        defaultValue,
        validate: (input) => {
          try {
            serverSchema[key].parse(input);
            return;
          } catch (error) {
            return error.message;
          }
        },
      });

      if (isCancel(value)) {
        outro(chalk.yellow('Operation cancelled'));
        process.exit(0);
      }

      config[key] = value;
    }
  }

  return config;
}

function generateWebEnvContent(config) {
  return `
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=zephyr
POSTGRES_PORT=5433
POSTGRES_HOST=localhost
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/zephyr?schema=public
POSTGRES_PRISMA_URL=postgresql://postgres:postgres@localhost:5433/zephyr?schema=public
POSTGRES_URL_NON_POOLING=postgresql://postgres:postgres@localhost:5433/zephyr?schema=public

# Redis
REDIS_PASSWORD=${config.REDIS_PASSWORD}
REDIS_PORT=${config.REDIS_PORT}
REDIS_HOST=${config.REDIS_HOST}
REDIS_URL=redis://:${config.REDIS_PASSWORD}@${config.REDIS_HOST}:${config.REDIS_PORT}/0

# MinIO
MINIO_ROOT_USER=${config.MINIO_ROOT_USER}
MINIO_ROOT_PASSWORD=${config.MINIO_ROOT_PASSWORD}
MINIO_BUCKET_NAME=uploads
MINIO_PORT=${config.MINIO_PORT}
MINIO_CONSOLE_PORT=9001
MINIO_HOST=${config.MINIO_HOST}
MINIO_ENDPOINT=http://${config.MINIO_HOST}:${config.MINIO_PORT}
NEXT_PUBLIC_MINIO_ENDPOINT=http://localhost:${config.MINIO_PORT}
MINIO_ENABLE_OBJECT_LOCKING=on

# Application
JWT_SECRET=${config.JWT_SECRET}
JWT_EXPIRES_IN=7d
NEXT_PUBLIC_PORT=3000
NEXT_PUBLIC_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000

#Misc
NODE_ENV=development
NEXT_TELEMETRY_DISABLED=1
TURBO_TELEMERY_DISABLED=1
`.trim();
}

export async function validateEnvFiles(projectRoot) {
  const envPaths = {
    web: path.join(projectRoot, 'apps/web/.env'),
    db: path.join(projectRoot, 'packages/db/.env'),
  };

  const results = {
    valid: true,
    errors: [],
  };

  for (const [name, filePath] of Object.entries(envPaths)) {
    try {
      const envContent = await fs.readFile(filePath, 'utf8');
      const env = Object.fromEntries(
        envContent
          .split('\n')
          .filter((line) => line.trim() && !line.trim().startsWith('#'))
          .map((line) => line.split('=').map((part) => part.trim())),
      );

      const validationErrors = [];
      for (const [key, value] of Object.entries(env)) {
        if (serverSchema[key]) {
          try {
            serverSchema[key].parse(value);
          } catch (error) {
            validationErrors.push(`${key}: ${error.message}`);
          }
        }
      }

      if (validationErrors.length > 0) {
        results.valid = false;
        results.errors.push({
          file: name,
          errors: validationErrors.map((err) => ({ message: err })),
        });
      }
    } catch (error) {
      results.valid = false;
      results.errors.push({
        file: name,
        errors: [{ message: error.message }],
      });
    }
  }

  return results;
}
