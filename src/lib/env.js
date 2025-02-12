import { z } from 'zod';
import { createEnv } from '@t3-oss/env-core';
import fs from 'fs-extra';
import path from 'node:path';
import { select, text, isCancel, outro } from '@clack/prompts';
import ora from 'ora';
import chalk from 'chalk';

/*
  Define the server schema (without triggering validation immediately).
*/
const serverSchema = {
  // Database
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  POSTGRES_DB: z.string().min(1),
  POSTGRES_PORT: z.string().default('5433'),
  POSTGRES_HOST: z.string().default('localhost'),
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_PASSWORD: z.string().min(1),
  REDIS_PORT: z.string().default('6379'),
  REDIS_HOST: z.string().default('localhost'),

  // MinIO
  MINIO_ROOT_USER: z.string().min(1),
  MINIO_ROOT_PASSWORD: z.string().min(1),
  MINIO_BUCKET_NAME: z.string().default('uploads'),
  MINIO_PORT: z.string().default('9000'),
  MINIO_CONSOLE_PORT: z.string().default('9001'),

  // Application
  JWT_SECRET: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
};

/*
  Instead of creating the env schema at the top level, we expose a function
  that creates the schema using the runtime environment provided.
*/
export function getEnvSchema(runtimeEnv) {
  return createEnv({
    server: serverSchema,
    runtimeEnv,
  });
}

export async function createEnvFiles(projectRoot) {
  const envType = await select({
    message: 'How would you like to configure environment variables?',
    options: [
      { value: 'automatic', label: 'Automatic', hint: 'Use default development configuration' },
      { value: 'manual', label: 'Manual', hint: 'Configure each variable manually' },
    ],
  });

  if (isCancel(envType)) {
    outro(chalk.yellow('Operation cancelled'));
    process.exit(0);
  }

  if (envType === 'automatic') {
    return createAutomaticEnvFiles(projectRoot);
  }
  return createManualEnvFiles(projectRoot);
}

async function createAutomaticEnvFiles(projectRoot) {
  const spinner = ora({
    text: 'Creating environment files...',
    color: 'cyan',
  }).start();

  const REDIS_PASSWORD = 'zephyrredis';
  const REDIS_HOST = 'localhost';
  const REDIS_PORT = '6379';
  const MINIO_HOST = 'localhost';
  const MINIO_PORT = '9000';

  const webEnvContent = `
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
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_PORT=${REDIS_PORT}
REDIS_HOST=${REDIS_HOST}
REDIS_URL=redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}/0

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_BUCKET_NAME=uploads
MINIO_PORT=${MINIO_PORT}
MINIO_CONSOLE_PORT=9001
MINIO_HOST=${MINIO_HOST}
MINIO_ENDPOINT=http://${MINIO_HOST}:${MINIO_PORT}
NEXT_PUBLIC_MINIO_ENDPOINT=http://localhost:${MINIO_PORT}
MINIO_ENABLE_OBJECT_LOCKING=on

# Application
JWT_SECRET=zephyrjwtsupersecret
JWT_EXPIRES_IN=7d
NEXT_PUBLIC_PORT=3000
NEXT_PUBLIC_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000

#Misc
NODE_ENV=development
NEXT_TELEMETRY_DISABLED=1
TURBO_TELEMERY_DISABLED=1
`.trim();

  const dbEnvContent = `
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

  try {
    const webEnvPath = path.join(projectRoot, 'apps/web/.env');
    await fs.ensureDir(path.dirname(webEnvPath));
    await fs.writeFile(webEnvPath, webEnvContent);

    const dbEnvPath = path.join(projectRoot, 'packages/db/.env');
    await fs.ensureDir(path.dirname(dbEnvPath));
    await fs.writeFile(dbEnvPath, dbEnvContent);

    spinner.succeed('Environment files created successfully');
    return { web: webEnvPath, db: dbEnvPath };
  } catch (error) {
    spinner.fail(`Failed to create environment files: ${error.message}`);
    throw error;
  }
}

async function createManualEnvFiles(projectRoot) {
  const envPaths = {
    web: path.join(projectRoot, 'apps/web/.env'),
    db: path.join(projectRoot, 'packages/db/.env'),
  };

  const defaultValues = {
    POSTGRES_USER: 'postgres',
    POSTGRES_PASSWORD: 'postgres',
    POSTGRES_DB: 'zephyr',
    REDIS_PASSWORD: 'zephyrredis',
    MINIO_ROOT_USER: 'minioadmin',
    MINIO_ROOT_PASSWORD: 'minioadmin',
    JWT_SECRET: 'zephyrjwtsupersecret',
  };

  console.log(chalk.blue('\nConfiguring environment variables manually:'));
  console.log(chalk.yellow('Press Enter to use default values\n'));

  const envConfigs = {};

  for (const [key, defaultValue] of Object.entries(defaultValues)) {
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

    envConfigs[key] = value;
  }

  const spinner = ora({
    text: 'Creating environment files...',
    color: 'cyan',
  }).start();

  try {
    const webEnvContent = generateWebEnvContent(envConfigs);
    const dbEnvContent = generateDbEnvContent(envConfigs);

    await fs.ensureDir(path.dirname(envPaths.web));
    await fs.ensureDir(path.dirname(envPaths.db));
    await fs.writeFile(envPaths.web, webEnvContent);
    await fs.writeFile(envPaths.db, dbEnvContent);

    spinner.succeed('Environment files created successfully');
    return envPaths;
  } catch (error) {
    spinner.fail(`Failed to create environment files: ${error.message}`);
    throw error;
  }
}

function generateWebEnvContent(configs) {
  return `
# Database
POSTGRES_USER=${configs.POSTGRES_USER}
POSTGRES_PASSWORD=${configs.POSTGRES_PASSWORD}
POSTGRES_DB=${configs.POSTGRES_DB}
POSTGRES_PORT=5433
POSTGRES_HOST=localhost
DATABASE_URL=postgresql://${configs.POSTGRES_USER}:${configs.POSTGRES_PASSWORD}@localhost:5433/${configs.POSTGRES_DB}?schema=public

# Redis
REDIS_PASSWORD=${configs.REDIS_PASSWORD}
REDIS_PORT=6379
REDIS_HOST=localhost
REDIS_URL=redis://:${configs.REDIS_PASSWORD}@localhost:6379/0

# MinIO
MINIO_ROOT_USER=${configs.MINIO_ROOT_USER}
MINIO_ROOT_PASSWORD=${configs.MINIO_ROOT_PASSWORD}
MINIO_BUCKET_NAME=uploads
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_ENDPOINT=http://localhost:9000

# Application
JWT_SECRET=${configs.JWT_SECRET}
NODE_ENV=development
`.trim();
}

function generateDbEnvContent(configs) {
  return `
DATABASE_URL=postgresql://${configs.POSTGRES_USER}:${configs.POSTGRES_PASSWORD}@localhost:5433/${configs.POSTGRES_DB}
POSTGRES_USER=${configs.POSTGRES_USER}
POSTGRES_PASSWORD=${configs.POSTGRES_PASSWORD}
POSTGRES_DB=${configs.POSTGRES_DB}
`.trim();
}

/*
  validateEnvFiles now defers schema validation to runtime.
  It reads the .env files, parses their content, and then uses getEnvSchema()
  to validate the values.
*/
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

      getEnvSchema(env).server.parse(env);
    } catch (error) {
      results.valid = false;
      results.errors.push({
        file: name,
        errors: error.errors || [{ message: error.message }],
      });
    }
  }

  return results;
}
