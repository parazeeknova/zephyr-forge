import { execSync } from 'node:child_process';
import fs from 'fs-extra';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import retry from 'async-retry';
import chalk from 'chalk';
import { select, spinner, confirm, isCancel } from '@clack/prompts';
import boxen from 'boxen';
import { createSpinner } from './ui.js';

export const sleep = (ms) => setTimeout(ms);

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
            '⚠️  Optional Dependencies Check',
            '',
            ...missing.map(
              (dep) => `${chalk.bold(dep.name)} is not installed. You can install it by:`,
            ),
            '',
            'Installation options:',
            ...missing.map((dep) =>
              [
                `${dep.name}:`,
                `  • Automatic: ${chalk.cyan(dep.installCmd)}`,
                `  • Manual: Visit ${chalk.cyan(dep.installUrl)}`,
              ].join('\n'),
            ),
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

    const action = await select({
      message: 'How would you like to proceed?',
      options: [
        { value: 'install', label: 'Install Missing', hint: 'Install all missing dependencies' },
        { value: 'skip', label: 'Skip Installation', hint: '⚠️ Some features may be limited' },
        { value: 'cancel', label: 'Cancel Setup', hint: 'Exit the setup process' },
      ],
    });

    if (action === 'cancel') {
      console.log(chalk.yellow('Setup cancelled'));
      process.exit(0);
    }

    if (action === 'skip') {
      console.log(
        boxen(
          chalk.yellow(
            [
              '⚠️ Warning: Proceeding without optional dependencies',
              '',
              'Some features may be limited or unavailable:',
              ...missing.map((dep) => `• ${dep.name}: Required for optimal experience`),
              '',
              'You can install these later using:',
              ...missing.map((dep) => chalk.dim(dep.installCmd)),
            ].join('\n'),
          ),
          {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'yellow',
            title: '⚠️ Limited Functionality',
            titleAlignment: 'center',
          },
        ),
      );
      return true;
    }

    if (action === 'install') {
      const s = spinner();

      for (const dep of missing) {
        try {
          s.start(`Installing ${dep.name}...`);

          try {
            execSync(dep.checkCmd, { stdio: 'pipe' });
            s.stop(chalk.green(`✓ ${dep.name} is already installed`));
            continue;
          } catch {
            execSync(dep.installCmd, { stdio: 'pipe' });
          }

          try {
            execSync(dep.checkCmd, { stdio: 'pipe' });
            s.stop(chalk.green(`✓ ${dep.name} installed successfully`));
          } catch (error) {
            throw new Error('Installation verification failed');
          }
        } catch (error) {
          s.stop(chalk.red(`Failed to install ${dep.name}`));

          const skip = await select({
            message: `What would you like to do about ${dep.name}?`,
            options: [
              { value: 'retry', label: 'Retry Installation', hint: 'Try installing again' },
              { value: 'skip', label: 'Skip This Dependency', hint: 'Continue without it' },
              { value: 'cancel', label: 'Cancel Setup', hint: 'Exit the process' },
            ],
          });

          if (skip === 'cancel') {
            process.exit(0);
          }

          if (skip === 'retry') {
            continue;
          }

          console.log(
            boxen(
              chalk.yellow(
                [
                  `⚠️ ${dep.name} installation skipped`,
                  '',
                  'You can install it manually later using:',
                  chalk.dim(dep.installCmd),
                  '',
                  'Some features may be limited without this dependency.',
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
        }
      }
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
      errorMessage: 'pnpm is not installed. Run: npm install -g pnpm',
      optional: true,
      verifyCommand: async () => {
        try {
          execSync('pnpm --version', { stdio: 'pipe' });
          return true;
        } catch {
          return false;
        }
      },
    },
    {
      name: 'bun',
      command: 'bun --version',
      errorMessage: 'bun is not installed. Run: npm install -g bun',
      optional: true,
      verifyCommand: async () => {
        try {
          execSync('bun --version', { stdio: 'pipe' });
          return true;
        } catch {
          return false;
        }
      },
    },
  ];

  const results = [];

  for (const req of requirements) {
    try {
      if (req.verifyCommand) {
        const isInstalled = await req.verifyCommand();
        if (!isInstalled) throw new Error(req.errorMessage);
      } else {
        await execWithRetry(req.command, { silent: true });
      }
      results.push({ name: req.name, installed: true });
    } catch (error) {
      results.push({
        name: req.name,
        installed: false,
        error: req.errorMessage,
        optional: req.optional,
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

export async function runPostSetupTasks(projectRoot, depsInstalled) {
  const s = createSpinner('Running post-setup tasks...');
  s.start();

  try {
    if (depsInstalled) {
      const runPrisma = await confirm({
        message: 'Generate Prisma client? (Recommended)',
        initialValue: true,
      });

      if (isCancel(runPrisma)) {
        outro(chalk.yellow('Operation cancelled'));
        process.exit(0);
      }

      if (runPrisma) {
        s.text = 'Generating Prisma client...';
        try {
          // First ensure we're in the db package directory
          const dbPath = path.join(projectRoot, 'packages/db');
          if (!(await fs.pathExists(path.join(dbPath, 'package.json')))) {
            throw new Error('packages/db/package.json not found');
          }

          await execWithRetry('pnpm install', {
            cwd: dbPath,
            silent: true,
          });

          // Then run prisma generate
          await execWithRetry('pnpm prisma generate', {
            cwd: dbPath,
            silent: false,
          });
        } catch (error) {
          console.log(
            boxen(
              chalk.yellow(
                [
                  '⚠️ Prisma client generation failed',
                  '',
                  'You can generate it manually later using:',
                  chalk.dim('cd packages/db'),
                  chalk.dim('pnpm install'),
                  chalk.dim('pnpm prisma generate'),
                  '',
                  'Error details:',
                  chalk.red(error.message),
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

          const skipPrisma = await confirm({
            message: 'Continue without Prisma client?',
            initialValue: false,
          });

          if (!skipPrisma) {
            throw error;
          }
        }
      }

      // Biome Formatting
      const runBiome = await confirm({
        message: 'Format code with Biome? (Recommended)',
        initialValue: true,
      });

      if (isCancel(runBiome)) {
        outro(chalk.yellow('Operation cancelled'));
        process.exit(0);
      }

      if (runBiome) {
        s.text = 'Running code formatting...';
        try {
          await execWithRetry('pnpm run biome:fix', {
            cwd: projectRoot,
            silent: true,
          });
        } catch (error) {
          console.log(chalk.yellow('Biome formatting failed, skipping...'));
        }
      }

      // Git Add
      if (runBiome) {
        const runGitAdd = await confirm({
          message: 'Save formatted changes with git? (Recommended)',
          initialValue: true,
        });

        if (isCancel(runGitAdd)) {
          outro(chalk.yellow('Operation cancelled'));
          process.exit(0);
        }

        if (runGitAdd) {
          s.text = 'Saving formatted changes...';
          try {
            await execWithRetry('git add .', {
              cwd: projectRoot,
              silent: true,
            });
          } catch (error) {
            console.log(chalk.yellow('Git add failed, skipping...'));
          }
        }
      }

      s.succeed('Post-setup tasks completed');
    } else {
      s.stop();
      console.log(
        boxen(
          chalk.yellow(
            [
              '⚠️ Manual Steps Required',
              '',
              'Please run these commands manually:',
              '',
              '1. Generate Prisma client:',
              chalk.dim('   cd packages/db'),
              chalk.dim('   pnpm install'),
              chalk.dim('   pnpm prisma generate'),
              '',
              '2. Format code:',
              chalk.dim('   pnpm run biome:fix'),
              '',
              '3. Save changes:',
              chalk.dim('   git add .'),
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
    }
  } catch (error) {
    s.fail(`Post-setup tasks failed: ${error.message}`);
    throw error;
  }
}
