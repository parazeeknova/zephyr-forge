import { execSync } from 'node:child_process';
import fs from 'fs-extra';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import retry from 'async-retry';
import chalk from 'chalk';
import { fileURLToPath } from 'node:url';

export const sleep = (ms) => setTimeout(ms);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function copyProjectTemplate(targetDir) {
  const templateDir = path.join(__dirname, '../../templates/default');

  try {
    if (!(await fs.pathExists(templateDir))) {
      throw new Error('Project template not found');
    }
    await fs.copy(templateDir, targetDir, {
      filter: (src) => {
        const basename = path.basename(src);
        return !basename.startsWith('.') && basename !== 'node_modules' && basename !== 'dist';
      },
    });

    const dirs = [
      'packages',
      'packages/db',
      'packages/api',
      'packages/web',
      'docker',
      'docker/postgres',
      'docker/redis',
      'docker/minio',
    ];

    for (const dir of dirs) {
      await fs.ensureDir(path.join(targetDir, dir));
    }

    const envFile = path.join(targetDir, '.env');
    if (!(await fs.pathExists(envFile))) {
      await fs.writeFile(envFile, '# Environment Variables\n');
    }
  } catch (error) {
    throw new Error(`Failed to copy project template: ${error.message}`);
  }
}

export async function findProjectRoot(startDir) {
  let currentDir = startDir;
  while (currentDir !== path.parse(currentDir).root) {
    if (
      (await fs.pathExists(path.join(currentDir, 'package.json'))) &&
      (await fs.pathExists(path.join(currentDir, 'docker-compose.dev.yml')))
    ) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  throw new Error(
    'Could not find project root (looking for package.json and docker-compose.dev.yml)',
  );
}

export async function execWithRetry(command, options = {}) {
  const { cwd, maxRetries = 3, retryDelay = 1000, silent = false, ...execOptions } = options;

  return retry(
    async (bail) => {
      try {
        const result = execSync(command, {
          stdio: silent ? 'pipe' : 'inherit',
          cwd,
          ...execOptions,
        });
        return result.toString();
      } catch (error) {
        if (error.message.includes('ENOENT')) {
          bail(new Error(`Command not found: ${command}`));
          return;
        }
        throw error;
      }
    },
    {
      retries: maxRetries,
      minTimeout: retryDelay,
      onRetry: (error, attempt) => {
        if (!silent) {
          console.log(chalk.yellow(`Retry attempt ${attempt}/${maxRetries}: ${error.message}`));
        }
      },
    },
  );
}

export async function checkRequirements() {
  const requirements = [
    {
      name: 'Docker',
      command: 'docker --version',
      errorMessage: 'Docker is not installed. Please install Docker first.',
    },
    {
      name: 'Docker Compose',
      command: 'docker-compose --version',
      errorMessage: 'Docker Compose is not installed. Please install Docker Compose first.',
    },
    {
      name: 'pnpm',
      command: 'pnpm --version',
      errorMessage: 'pnpm is not installed. Please install pnpm first: npm install -g pnpm',
    },
  ];

  const results = [];

  for (const req of requirements) {
    try {
      await execWithRetry(req.command, { silent: true });
      results.push({ name: req.name, installed: true });
    } catch (error) {
      results.push({
        name: req.name,
        installed: false,
        error: req.errorMessage,
      });
    }
  }

  return results;
}

export function getDockerLogs(container, lines = 50) {
  try {
    const logs = execSync(`docker logs --tail ${lines} ${container}`, {
      stdio: 'pipe',
    }).toString();
    return logs.split('\n');
  } catch (error) {
    return [];
  }
}

export async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const net = require('node:net');
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
}

export function validateProjectStructure(projectRoot) {
  const requiredFiles = [
    'package.json',
    'docker-compose.dev.yml',
    'apps/web/package.json',
    'packages/db/package.json',
  ];

  const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(projectRoot, file)));

  return {
    valid: missingFiles.length === 0,
    missingFiles,
  };
}
