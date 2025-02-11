#!/usr/bin/env node

import { outro, select, confirm, text, isCancel } from '@clack/prompts';
import { setTimeout } from 'node:timers/promises';
import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import { findProjectRoot, checkRequirements } from '../lib/utils.js';
import { displayBanner } from '../lib/ui.js';
import { setupCommand } from './commands/setup.js';
import { devCommand } from './commands/dev.js';

const sleep = (ms = 1000) => setTimeout(ms);

async function main() {
  try {
    await displayBanner();
    await sleep(500);

    const validCommands = ['setup', 'init', 'dev'];
    const command = process.argv[2];

    if (!command || !validCommands.includes(command)) {
      console.log(
        chalk.red('\n📌 Usage:'),
        '\n   npx zephyr-forge@latest setup  (Initialize and start development)',
        '\n   npx zephyr-forge@latest init   (Only initialize)',
        '\n   npx zephyr-forge@latest dev    (Only start development)',
      );
      process.exit(1);
    }

    const requirements = await checkRequirements();
    const dockerStatus = await checkDocker().catch(() => ({
      installed: false,
      error: 'Docker is not running',
    }));
    requirements.push(dockerStatus);
    const missingReqs = requirements.filter((req) => !req.installed);

    if (missingReqs.length > 0) {
      console.log(chalk.red('\n❌ Missing requirements:'));
      missingReqs.forEach((req) => {
        console.log(chalk.yellow(`• ${req.name}: ${req.error}`));
      });
      process.exit(1);
    }

    if (!process.argv[2]) {
      const command = await select({
        message: 'What would you like to do?',
        options: [
          { value: 'setup', label: 'Setup Project', hint: 'Initialize and start development' },
          { value: 'init', label: 'Initialize Only', hint: 'Create a new Zephyr project' },
          { value: 'dev', label: 'Development Only', hint: 'For existing project' },
          { value: 'exit', label: 'Exit' },
        ],
      });

      if (isCancel(command)) {
        outro(chalk.yellow('Operation cancelled'));
        process.exit(0);
      }

      process.argv[2] = command;
    }

    switch (process.argv[2]) {
      case 'setup': {
        const projectName = await text({
          message: 'Enter project name:',
          defaultValue: 'zephyr-app',
          validate: (value) => {
            if (value.length === 0) return 'Project name is required';
            if (!/^[a-z0-9-]+$/.test(value))
              return 'Project name can only contain lowercase letters, numbers, and dashes';
            return;
          },
        });

        if (isCancel(projectName)) {
          outro(chalk.yellow('Operation cancelled'));
          process.exit(0);
        }

        const targetDir = path.join(process.cwd(), projectName);

        if (await fs.pathExists(targetDir)) {
          const overwrite = await confirm({
            message: `Directory ${projectName} already exists. Overwrite?`,
            initialValue: false,
          });

          if (isCancel(overwrite) || !overwrite) {
            outro(chalk.yellow('Operation cancelled'));
            process.exit(0);
          }

          await fs.remove(targetDir);
        }

        await setupCommand({ projectRoot: targetDir, projectName });

        const startDev = await confirm({
          message: 'Setup complete! Would you like to start the development environment?',
          initialValue: true,
        });

        if (startDev) {
          process.chdir(targetDir);
          await devCommand({ projectRoot: targetDir });
        } else {
          outro(
            chalk.green(
              '✨ Setup complete! Run `cd ${projectName} && npx zephyr-forge dev` to start development',
            ),
          );
        }
        break;
      }

      case 'init': {
        const projectName = await text({
          message: 'Enter project name:',
          defaultValue: 'zephyr-app',
          validate: (value) => {
            if (value.length === 0) return 'Project name is required';
            if (!/^[a-z0-9-]+$/.test(value))
              return 'Project name can only contain lowercase letters, numbers, and dashes';
            return;
          },
        });

        if (isCancel(projectName)) {
          outro(chalk.yellow('Operation cancelled'));
          process.exit(0);
        }

        const targetDir = path.join(process.cwd(), projectName);

        if (await fs.pathExists(targetDir)) {
          const overwrite = await confirm({
            message: `Directory ${projectName} already exists. Overwrite?`,
            initialValue: false,
          });

          if (isCancel(overwrite) || !overwrite) {
            outro(chalk.yellow('Operation cancelled'));
            process.exit(0);
          }

          await fs.remove(targetDir);
        }

        await setupCommand({ projectRoot: targetDir, projectName });
        break;
      }

      case 'dev': {
        let projectRoot;
        try {
          projectRoot = await findProjectRoot(process.cwd());
        } catch (error) {
          console.log(
            chalk.red(
              '⚠️  Not in a Zephyr project directory. Please run this command from your Zephyr project root.',
            ),
          );
          process.exit(1);
        }
        await devCommand({ projectRoot });
        break;
      }

      case 'exit': {
        outro(chalk.green('👋 Goodbye!'));
        process.exit(0);
        break;
      }

      default: {
        console.log(chalk.red('\n❌ Unknown command:', process.argv[2]));
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error.message);

    const retry = await confirm({
      message: 'Would you like to try again?',
      initialValue: true,
    });

    if (retry) {
      return main();
    }

    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Gracefully shutting down...'));
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('\n❌ Fatal error:'), error);
  process.exit(1);
});

main().catch((error) => {
  console.error(chalk.red('\n❌ Unhandled error:'), error);
  process.exit(1);
});
