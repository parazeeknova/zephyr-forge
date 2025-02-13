import { outro, select, confirm, text, isCancel } from '@clack/prompts';
import { setTimeout } from 'node:timers/promises';
import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import os from 'node:os';
import { findProjectRoot, checkRequirements, checkDependencies } from '../lib/utils.js';
import { displayBanner } from '../lib/ui.js';
import { setupCommand } from './commands/setup.js';
import { devCommand } from './commands/dev.js';
import { checkDocker } from '../lib/docker.js';
import { handleDirectorySetup, ensureParentDirectory } from '../lib/handler.js';
import boxen from 'boxen';
import { checkEnvCommand } from './commands/env.js';

const sleep = (ms = 1000) => setTimeout(ms);

async function getPreferredLocations() {
  const homeDir = os.homedir();
  const currentDir = process.cwd();

  const defaultDevDirs =
    {
      win32: {
        forks: 'C:\\Forks',
        dev: 'C:\\Dev',
        projects: path.join(homeDir, 'Projects'),
      },
      darwin: {
        dev: path.join(homeDir, 'Development'),
        projects: path.join(homeDir, 'Projects'),
      },
      linux: {
        dev: path.join(homeDir, 'dev'),
        projects: path.join(homeDir, 'projects'),
      },
    }[process.platform] || {};

  const locations = [
    {
      value: path.join(currentDir, 'zephyr'),
      label: 'Current Directory',
      hint: `(${path.join(currentDir, 'zephyr')})`,
    },
    ...Object.entries(defaultDevDirs).map(([key, dir]) => ({
      value: path.join(dir, 'zephyr'),
      label: `${key.charAt(0).toUpperCase() + key.slice(1)} Directory`,
      hint: `(${path.join(dir, 'zephyr')})`,
    })),
    {
      value: 'custom',
      label: 'Custom Location',
      hint: '(specify your own path)',
    },
  ];

  return locations;
}

function showHelp() {
  console.log(
    boxen(
      [
        chalk.bold('🚀 Zephyr Forge CLI'),
        '',
        chalk.yellow('Usage:'),
        '  npx zephyr-forge@latest [command] [options]',
        '',
        chalk.yellow('Commands:'),
        '  setup         Initialize and start development environment',
        '  init          Create a new Zephyr project',
        '  dev           Start development environment for existing project',
        '  env:check     Check environment requirements',
        '  env:validate  Validate environment configuration',
        '  env:fix       Fix environment configuration',
        '',
        chalk.yellow('Options:'),
        '  --help, -h    Show this help message',
        '  --version, -v Show version number',
        '',
        chalk.yellow('Examples:'),
        '  npx zephyr-forge@latest setup    # Setup new project',
        '  npx zephyr-forge@latest init     # Initialize project only',
        '  npx zephyr-forge@latest dev      # Start development',
        '',
        chalk.yellow('Documentation:'),
        '  https://github.com/parazeeknova/zephyr-forge',
        '',
        chalk.yellow('Environment Setup:'),
        '  • Requires Docker, pnpm, and bun',
        '  • Automatically configures development containers',
        '  • Sets up PostgreSQL, Redis, and MinIO',
        '',
        chalk.yellow('Project Structure:'),
        '  • /apps          Application code',
        '  • /packages      Shared packages',
        '  • /docker        Container configurations',
        '  • /prisma        Database schemas',
        '',
        chalk.yellow('Additional Information:'),
        '  • Use --help with any command for more details',
        '  • Check documentation for advanced configuration',
        '  • Report issues on GitHub',
      ].join('\n'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'blue',
        title: '📚 Help & Documentation',
        titleAlignment: 'center',
      },
    ),
  );
}

function showCommandHelp(command) {
  const helpContent = {
    setup: [
      chalk.bold('🛠️  Setup Command'),
      '',
      chalk.yellow('Description:'),
      '  Initialize a new Zephyr project and set up development environment',
      '',
      chalk.yellow('Usage:'),
      '  npx zephyr-forge@latest setup [options]',
      '',
      chalk.yellow('Process:'),
      '  1. Clones Zephyr repository',
      '  2. Sets up environment configuration',
      '  3. Initializes Docker containers',
      '  4. Configures development services',
      '',
      chalk.yellow('Services Setup:'),
      '  • PostgreSQL Database',
      '  • Redis Cache',
      '  • MinIO Object Storage',
      '',
      chalk.yellow('Requirements:'),
      '  • Docker running',
      '  • pnpm installed',
      '  • bun installed',
    ],
    init: [
      chalk.bold('🎯 Init Command'),
      '',
      chalk.yellow('Description:'),
      '  Create a new Zephyr project without starting development environment',
      '',
      chalk.yellow('Usage:'),
      '  npx zephyr-forge@latest init [project-name]',
      '',
      chalk.yellow('Options:'),
      '  project-name    Name of your project (optional)',
      '',
      chalk.yellow('Process:'),
      '  1. Creates project directory',
      '  2. Sets up basic configuration',
      '  3. Initializes git repository',
      '  4. Installs dependencies',
    ],
    dev: [
      chalk.bold('👩‍💻 Dev Command'),
      '',
      chalk.yellow('Description:'),
      '  Start development environment for existing Zephyr project',
      '',
      chalk.yellow('Usage:'),
      '  npx zephyr-forge@latest dev',
      '',
      chalk.yellow('Process:'),
      '  1. Verifies project structure',
      '  2. Starts Docker containers',
      '  3. Checks service health',
      '  4. Initializes development environment',
      '',
      chalk.yellow('Available Services:'),
      '  • PostgreSQL: localhost:5433',
      '  • Redis: localhost:6379',
      '  • MinIO Console: http://localhost:9001',
    ],
  };

  if (helpContent[command]) {
    console.log(
      boxen(helpContent[command].join('\n'), {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
        title: `Help: ${command}`,
        titleAlignment: 'center',
      }),
    );
  } else {
    showHelp();
  }
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const helpFlags = ['--help', '-h'];
    const validCommands = ['setup', 'init', 'dev', 'env:check', 'env:validate', 'env:fix'];
    const versionFlags = ['--version', '-v'];

    if (args.length === 0) {
      await displayBanner();
      await sleep(500);
      showHelp();
      process.exit(0);
    }

    if (args.some((arg) => versionFlags.includes(arg))) {
      console.log(`Zephyr Forge v${process.env.npm_package_version}` || '1.0.16');
      process.exit(0);
    }

    if (args.some((arg) => helpFlags.includes(arg))) {
      const command = args[0];
      if (validCommands.includes(command)) {
        showCommandHelp(command);
      } else {
        await displayBanner();
        await sleep(500);
        showHelp();
      }
      process.exit(0);
    }

    await displayBanner();
    await sleep(500);

    await checkDependencies();
    const command = process.argv[2];

    if (!command || !validCommands.includes(command)) {
      console.log(
        chalk.red('\n📌 Usage:'),
        '\n   npx zephyr-forge@latest setup  (Initialize and start development)',
        '\n   npx zephyr-forge@latest init   (Only initialize)',
        '\n   npx zephyr-forge@latest dev    (Only start development)',
        '\n   npx zephyr-forge@latest --help (Show help and options)',
        '\n   npx zephyr-forge@latest --version (Show version number)',
        '\n   npx zephyr-forge@latest env:check (Check environment requirements)',
        '\n   npx zephyr-forge@latest env:validate (Validate environment configuration)',
        '\n   npx zephyr-forge@latest env:fix (Fix environment configuration)',
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
          { value: 'help', label: 'Help', hint: 'Show help and options' },
          { value: 'version', label: 'Version', hint: 'Show version number' },
          { value: 'env:check', label: 'Check Environment', hint: 'Verify system requirements' },
          { value: 'env:validate', label: 'Validate Environment', hint: 'Check configuration' },
          { value: 'env:fix', label: 'Fix Environment', hint: 'Automatically fix issues' },
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
        const locations = await getPreferredLocations();

        const locationChoice = await select({
          message: 'Where would you like to clone Zephyr?',
          options: locations,
          initialValue: locations[0].value,
        });

        if (isCancel(locationChoice)) {
          outro(chalk.yellow('Operation cancelled'));
          process.exit(0);
        }

        let targetDir = locationChoice;

        if (locationChoice === 'custom') {
          targetDir = await text({
            message: 'Enter the path where you want to clone Zephyr:',
            placeholder: path.join(os.homedir(), 'your', 'custom', 'path', 'zephyr'),
            validate: (value) => {
              if (value.length === 0) return 'Directory is required';
              if (!path.isAbsolute(value)) return 'Please provide an absolute path';
              return;
            },
          });

          if (isCancel(targetDir)) {
            outro(chalk.yellow('Operation cancelled'));
            process.exit(0);
          }
        }

        await ensureParentDirectory(targetDir);
        const setupResult = await handleDirectorySetup(targetDir);
        process.chdir(setupResult.path);
        await setupCommand({ projectRoot: setupResult.path });

        const startDev = await confirm({
          message: 'Setup complete! Would you like to start the development environment?',
          initialValue: true,
        });

        if (startDev) {
          await devCommand({ projectRoot: setupResult.path });
        } else {
          outro(
            chalk.green(`✨ Setup complete! Run the following commands to start development:
      cd ${path.basename(setupResult.path)}
      npx zephyr-forge dev`),
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

      case 'env:check':
      case 'env:validate':
      case 'env:fix': {
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

        const command = process.argv[2].split(':')[1];
        await checkEnvCommand({
          projectRoot,
          mode: command,
          fix: command === 'fix',
          validate: command === 'validate',
        });
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
