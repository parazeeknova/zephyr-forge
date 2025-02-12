import { intro, outro, spinner, confirm } from '@clack/prompts';
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

const REQUIRED_FILES = ['docker-compose.dev.yml', '.env', 'package.json'];

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

    s.start('Validating environment');
    const envValidation = await validateEnvFiles(projectRoot);
    if (!envValidation.valid) {
      throw new Error(
        `Environment validation failed:\n${envValidation.errors.map((e) => `- ${e.file}: ${e.message}`).join('\n')}`,
      );
    }
    s.stop('Environment validated');

    s.start('Checking Docker services');
    const status = await checkContainerStatus();
    s.stop('Service check complete');

    console.log(`\n${createServiceStatusTable(status)}`);

    if (status.needsInit) {
      const shouldInit = await confirm({
        message: 'Services need initialization. Would you like to proceed?',
        initialValue: true,
      });

      if (shouldInit) {
        try {
          await initializeServices({ showProgress: true });
        } catch (error) {
          throw new Error(`Service initialization failed: ${error.message}`);
        }
      } else {
        outro(chalk.yellow('Operation cancelled'));
        process.exit(0);
      }
    } else if (status.running.length > 0) {
      const restart = await confirm({
        message: 'Services are already running. Restart them?',
        initialValue: false,
      });

      if (restart) {
        s.start('Restarting services');
        await stopServices();
        await startServices();
        s.stop('Services restarted');
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
