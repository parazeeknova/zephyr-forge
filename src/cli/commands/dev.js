import { intro, outro, spinner, confirm, select, isCancel } from '@clack/prompts';
import chalk from 'chalk';
import path from 'node:path';
import { displayBanner } from '../../lib/ui.js';
import {
  checkContainerStatus,
  initializeServices,
  verifyServices,
  startServices,
  stopServices,
  checkServiceHealth,
} from '../../lib/services.js';
import { validateEnvFiles } from '../../lib/env.js';
import { createServiceStatusTable, showCompletionMessage } from '../../lib/ui.js';
import { findProjectRoot } from '../../lib/utils.js';
import fs from 'fs-extra';
import boxen from 'boxen';

const REQUIRED_FILES = ['docker-compose.dev.yml', 'package.json'];

const REQUIRED_ENV_FILES = {
  'apps/web/.env': [
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DB',
    'DATABASE_URL',
    'REDIS_PASSWORD',
    'MINIO_ROOT_USER',
    'MINIO_ROOT_PASSWORD',
  ],
  'packages/db/.env': ['DATABASE_URL', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB'],
};

export async function devCommand(options) {
  let cleanupDone = false;

  const cleanup = async () => {
    if (cleanupDone) return;
    cleanupDone = true;

    const s = spinner();
    s.start('Shutting down services...');

    try {
      await stopServices();
      s.stop('Services stopped successfully');
      outro(chalk.green('👋 Development environment shutdown complete'));
    } catch (error) {
      s.stop(chalk.red('Error during shutdown:', error.message));
    }

    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  await displayBanner('dev');
  intro(chalk.blue('🚀 Starting Zephyr Development Environment'));

  const s = spinner();
  try {
    let projectRoot = options.projectRoot;
    if (!projectRoot) {
      try {
        projectRoot = await findProjectRoot(process.cwd());
      } catch (error) {
        throw new Error(
          'Not in a Zephyr project directory. Please run this command from your project root.',
        );
      }
    }

    s.start('Checking project structure');
    for (const file of REQUIRED_FILES) {
      const filePath = path.join(projectRoot, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Missing required file: ${file}`);
      }
    }
    s.stop('Project structure valid');

    s.start('Checking environment files');
    const missingEnvFiles = [];
    const invalidEnvFiles = [];

    for (const [envPath, requiredVars] of Object.entries(REQUIRED_ENV_FILES)) {
      const fullPath = path.join(projectRoot, envPath);

      if (!fs.existsSync(fullPath)) {
        missingEnvFiles.push(envPath);
        continue;
      }

      try {
        const envContent = await fs.readFile(fullPath, 'utf8');
        const envVars = Object.fromEntries(
          envContent
            .split('\n')
            .filter((line) => line.trim() && !line.trim().startsWith('#'))
            .map((line) => line.split('=').map((part) => part.trim())),
        );

        const missingVars = requiredVars.filter((varName) => !envVars[varName]);
        if (missingVars.length > 0) {
          invalidEnvFiles.push({
            file: envPath,
            missing: missingVars,
          });
        }
      } catch (error) {
        throw new Error(`Error reading ${envPath}: ${error.message}`);
      }
    }

    if (missingEnvFiles.length > 0 || invalidEnvFiles.length > 0) {
      let errorMessage = '';

      if (missingEnvFiles.length > 0) {
        errorMessage += `Missing environment files:\n${missingEnvFiles.map((f) => `  - ${f}`).join('\n')}\n\n`;
      }

      if (invalidEnvFiles.length > 0) {
        errorMessage += `Invalid environment files:\n${invalidEnvFiles
          .map(({ file, missing }) => `  - ${file} is missing: ${missing.join(', ')}`)
          .join('\n')}`;
      }

      errorMessage += '\n\nTip: Run `zephyr-forge setup` to create/fix environment files';
      throw new Error(errorMessage);
    }

    s.start('Validating environment files');
    const envErrors = [];

    for (const [envPath, requiredVars] of Object.entries(REQUIRED_ENV_FILES)) {
      const fullPath = path.join(projectRoot, envPath);

      if (!fs.existsSync(fullPath)) {
        envErrors.push(`Missing environment file: ${envPath}`);
        continue;
      }

      try {
        const envContent = await fs.readFile(fullPath, 'utf8');
        const envVars = Object.fromEntries(
          envContent
            .split('\n')
            .filter((line) => line.trim() && !line.trim().startsWith('#'))
            .map((line) => line.split('=').map((part) => part.trim())),
        );

        const missingVars = requiredVars.filter((varName) => !envVars[varName]);
        if (missingVars.length > 0) {
          envErrors.push(
            `Missing required variables in ${envPath}:\n  ${missingVars.join('\n  ')}`,
          );
        }
      } catch (error) {
        envErrors.push(`Error reading ${envPath}: ${error.message}`);
      }
    }

    if (envErrors.length > 0) {
      throw new Error(`Environment validation failed:\n${envErrors.join('\n')}`);
    }
    s.stop('Environment files validated');

    s.start('Validating environment configuration');
    const envValidation = await validateEnvFiles(projectRoot);
    if (!envValidation.valid) {
      const errors = envValidation.errors
        .map((e) => `${e.file}: ${e.errors.map((err) => err.message).join(', ')}`)
        .join('\n');
      throw new Error(`Environment validation failed:\n${errors}`);
    }
    s.stop('Environment configuration valid');

    s.start('Checking Docker services');
    const status = await checkContainerStatus();
    s.stop('Service check complete');

    console.log(`\n${createServiceStatusTable(status)}`);

    if (status.needsInit) {
      const initChoice = await select({
        message: 'Services need initialization. How would you like to proceed?',
        options: [
          { value: 'proceed', label: 'Initialize Services', hint: 'Set up all required services' },
          { value: 'skip', label: 'Skip Initialization', hint: 'Continue without services' },
          { value: 'cancel', label: 'Cancel', hint: 'Exit setup process' },
        ],
      });

      if (isCancel(initChoice) || initChoice === 'cancel') {
        outro(chalk.yellow('Operation cancelled'));
        process.exit(0);
      }

      if (initChoice === 'skip') {
        console.log(
          boxen(
            chalk.yellow(
              [
                '⚠️ Skipping service initialization',
                '',
                'Remember: You will need to:',
                '1. Initialize services manually',
                '2. Run docker-compose up',
                '3. Ensure all services are healthy',
                '',
                'You can do this later using:',
                chalk.dim('docker-compose -f docker-compose.dev.yml up -d'),
              ].join('\n'),
            ),
            {
              padding: 1,
              margin: 1,
              borderStyle: 'round',
              borderColor: 'yellow',
              title: '⚠️ Manual Setup Required',
              titleAlignment: 'center',
            },
          ),
        );

        const proceed = await confirm({
          message: 'Continue without service health checks?',
          initialValue: false,
        });

        if (!proceed) {
          outro(chalk.yellow('Setup cancelled'));
          process.exit(0);
        }

        showCompletionMessage({
          directory: projectRoot,
          services: {},
          urls: {
            api: 'http://localhost:3456 (not available)',
            web: 'http://localhost:3000 (not available)',
            minio: 'http://localhost:9001 (not available)',
          },
          skipped: true,
        });

        outro(
          chalk.yellow('⚠️ Setup completed without services. Remember to initialize them manually.'),
        );
        process.exit(0);
        return;
      }

      if (initChoice === 'proceed') {
        try {
          await initializeServices({ showProgress: true });
        } catch (error) {
          throw new Error(`Service initialization failed: ${error.message}`);
        }
      }
    } else if (status.running.length > 0) {
      const serviceAction = await select({
        message: 'Services are already running. What would you like to do?',
        options: [
          { value: 'restart', label: 'Restart Services', hint: 'Stop and start all services' },
          { value: 'continue', label: 'Continue', hint: 'Use existing services' },
          { value: 'stop', label: 'Stop Services', hint: 'Stop all running services' },
        ],
      });

      if (isCancel(serviceAction)) {
        outro(chalk.yellow('Operation cancelled'));
        process.exit(0);
      }

      switch (serviceAction) {
        case 'restart':
          s.start('Restarting services');
          try {
            await stopServices();
            await startServices();
            s.stop('Services restarted successfully');
          } catch (error) {
            s.stop(chalk.red(`Failed to restart services: ${error.message}`));
            throw error;
          }
          break;

        case 'stop':
          s.start('Stopping services');
          try {
            await stopServices();
            s.stop('Services stopped successfully');
            outro(
              chalk.green(
                'Services have been stopped. Use `zephyr-forge dev` to start them again.',
              ),
            );
            process.exit(0);
          } catch (error) {
            s.stop(chalk.red(`Failed to stop services: ${error.message}`));
            throw error;
          }
          break;

        case 'continue':
          s.start('Checking service health');
          try {
            const healthCheck = await checkServiceHealth();
            if (!healthCheck.healthy) {
              s.stop(chalk.yellow('Warning: Some services may not be healthy'));
              console.log(chalk.dim('Health check issues:'));
              healthCheck.issues.forEach((issue) => {
                console.log(chalk.dim(`  • ${issue}`));
              });

              const proceed = await confirm({
                message: 'Continue anyway?',
                initialValue: false,
              });

              if (!proceed) {
                outro(chalk.yellow('Operation cancelled'));
                process.exit(0);
              }
            } else {
              s.stop('All services are healthy');
            }
          } catch (error) {
            s.stop(chalk.red(`Health check failed: ${error.message}`));
            throw error;
          }
          break;
      }
    }

    s.start('Performing health check');
    const healthStatus = await checkServiceHealth();

    if (!healthStatus.healthy) {
      throw new Error(
        `Service health check failed:\n${healthStatus.issues.map((issue) => `- ${issue}`).join('\n')}`,
      );
    }
    s.stop('All services are healthy');

    const services = await verifyServices();

    showCompletionMessage({
      directory: projectRoot,
      services: services.services,
      urls: {
        api: 'http://localhost:3456',
        web: 'http://localhost:3000',
        minio: 'http://localhost:9001',
      },
    });

    outro(chalk.green('✨ Development environment is running!'));

    process.stdin.resume();
  } catch (error) {
    s.stop(chalk.red(`Error: ${error.message}`));

    if (error.details) {
      console.log(chalk.yellow('\nError details:'));
      console.log(error.details);
    }

    if (error.message.includes('Missing environment file')) {
      console.log(chalk.yellow('\nTip: Run `zephyr-forge setup` to create environment files'));
    }

    const retry = await confirm({
      message: 'Would you like to try again?',
      initialValue: true,
    });

    if (retry) {
      return devCommand(options);
    }

    outro(chalk.red('Failed to start development environment.'));
    process.exit(1);
  }
}
