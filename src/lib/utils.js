import { execSync } from 'node:child_process';
import fs from 'fs-extra';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import retry from 'async-retry';
import chalk from 'chalk';
import { fileURLToPath } from 'node:url';

export const sleep = (ms) => setTimeout(ms);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function checkDependencies() {
  const dependencies = [
    {
      name: 'pnpm',
      checkCmd: 'pnpm --version',
      installCmd: 'npm install -g pnpm',
      installUrl: 'https://pnpm.io/installation',
    },
    {
      name: 'bun',
      checkCmd: 'bun --version',
      installCmd: 'npm install -g bun',
      installUrl: 'https://bun.sh/docs/installation',
    },
  ];

  const missing = [];

  for (const dep of dependencies) {
    try {
      execSync(dep.checkCmd, { stdio: 'pipe' });
    } catch (error) {
      missing.push(dep);
    }
  }

  if (missing.length > 0) {
    console.log(
      boxen(
        chalk.yellow(
          [
            '⚠️  Missing Required Dependencies',
            '',
            ...missing.map(
              (dep) => `${chalk.bold(dep.name)} is not installed. You can install it by:`,
              '',
              `• Automatic: ${chalk.cyan(dep.installCmd)}`,
              `• Manual: Visit ${chalk.cyan(dep.installUrl)}`,
              '',
            ),
            'Would you like to install the missing dependencies automatically?',
          ].join('\n'),
        ),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'yellow',
          title: '🔧 Dependencies Check',
          titleAlignment: 'center',
        },
      ),
    );

    const install = await confirm({
      message: 'Install missing dependencies?',
      initialValue: true,
    });

    if (install) {
      const spinner = createSpinner('Installing dependencies...');
      spinner.start();

      for (const dep of missing) {
        try {
          execSync(dep.installCmd, { stdio: 'pipe' });
          spinner.succeed(`Installed ${dep.name}`);
        } catch (error) {
          spinner.fail(`Failed to install ${dep.name}`);
          console.log(
            chalk.red(`Please install ${dep.name} manually:`, `\n${chalk.cyan(dep.installUrl)}`),
          );
          process.exit(1);
        }
      }
    } else {
      console.log(
        chalk.yellow('\nPlease install the required dependencies manually and try again.'),
      );
      process.exit(1);
    }
  }

  return true;
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

export async function cloneRepository(targetDir) {
  const REPO_URL = 'https://github.com/parazeeknova/zephyr.git';

  try {
    execSync(`git clone ${REPO_URL} "${targetDir}"`, {
      stdio: 'inherit',
    });
    return true;
  } catch (error) {
    throw new Error(`Failed to clone repository: ${error.message}`);
  }
}
