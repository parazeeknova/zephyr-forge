import { outro, select, confirm, text, isCancel, spinner } from '@clack/prompts';
import { setTimeout } from 'node:timers/promises';
import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import os from 'node:os';
import {
  findProjectRoot,
  checkRequirements,
  checkDependencies,
  runPostSetupTasks,
} from '../lib/utils.js';
import { displayBanner, showFinalOptions } from '../lib/ui.js';
import { setupCommand } from './commands/setup.js';
import { devCommand } from './commands/dev.js';
import { checkDocker } from '../lib/docker.js';
import { handleDirectorySetup, ensureParentDirectory } from '../lib/handler.js';
import boxen from 'boxen';
import { checkEnvCommand } from '../lib/env.js';
import { execSync } from 'node:child_process';

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
    const missingRequired = missingReqs.filter((req) => !req.optional);
    const missingOptional = missingReqs.filter((req) => req.optional);

    if (missingRequired.length > 0) {
      console.log(chalk.red('\n❌ Missing required dependencies:'));
      missingRequired.forEach((req) => {
        console.log(chalk.yellow(`• ${req.name}: ${req.error}`));
      });
      process.exit(1);
    }

    if (missingOptional.length > 0) {
      console.log(chalk.yellow('\n⚠️  Missing optional dependencies:'));
      missingOptional.forEach((req) => {
        console.log(chalk.dim(`• ${req.name}: ${req.error}`));
      });

      const installChoice = await select({
        message: 'How would you like to proceed with optional dependencies?',
        options: [
          {
            value: 'install',
            label: 'Install Missing',
            hint: 'Install all missing optional dependencies',
          },
          {
            value: 'skip',
            label: 'Skip Installation',
            hint: '⚠️ Some features may be limited',
          },
          {
            value: 'cancel',
            label: 'Cancel Setup',
            hint: 'Exit the setup process',
          },
        ],
      });

      if (isCancel(installChoice) || installChoice === 'cancel') {
        outro(chalk.yellow('Operation cancelled'));
        process.exit(0);
      }

      if (installChoice === 'skip') {
        console.log(
          boxen(
            chalk.yellow(
              [
                '⚠️ Warning: Proceeding without optional dependencies',
                '',
                'Some features may be limited or unavailable:',
                '• pnpm: Required for package management',
                '• bun: Required for optimal development experience',
                '',
                'You can install these later using:',
                chalk.dim('npm install -g pnpm'),
                chalk.dim('npm install -g bun'),
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
      }

      if (installChoice === 'install') {
        const s = spinner();
        for (const req of missingOptional) {
          try {
            s.start(`Installing ${req.name}...`);

            if (req.name === 'pnpm') {
              try {
                execSync('pnpm --version', { stdio: 'pipe' });
                s.stop(chalk.green(`✓ ${req.name} is already installed`));
                continue;
              } catch {
                execSync('npm install -g pnpm', { stdio: 'pipe' });
              }
            } else if (req.name === 'bun') {
              try {
                execSync('bun --version', { stdio: 'pipe' });
                s.stop(chalk.green(`✓ ${req.name} is already installed`));
                continue;
              } catch {
                execSync('npm install -g bun', { stdio: 'pipe' });
              }
            }

            try {
              execSync(`${req.name} --version`, { stdio: 'pipe' });
              s.stop(chalk.green(`✓ ${req.name} installed successfully`));
            } catch (error) {
              throw new Error('Installation verification failed');
            }
          } catch (error) {
            s.stop(chalk.red(`✗ Failed to install ${req.name}`));
            console.log(chalk.dim(`Error: ${error.message}`));

            const retry = await confirm({
              message: `Would you like to retry installing ${req.name}?`,
              initialValue: true,
            });

            if (retry) {
              continue;
            }

            console.log(
              boxen(
                chalk.yellow(
                  [
                    `⚠️ ${req.name} installation skipped`,
                    '',
                    'You can install it manually later using:',
                    chalk.dim(`npm install -g ${req.name}`),
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

        const depChoice = await select({
          message: 'How would you like to handle project dependencies?',
          options: [
            { value: 'install', label: 'Install Dependencies', hint: 'Recommended' },
            { value: 'skip', label: 'Skip Installation', hint: '⚠️ Manual setup required' },
            { value: 'cancel', label: 'Cancel Setup', hint: 'Exit setup process' },
          ],
        });

        if (depChoice === 'cancel' || isCancel(depChoice)) {
          outro(chalk.yellow('Setup cancelled'));
          process.exit(0);
        }

        if (depChoice === 'skip') {
          console.log(
            boxen(
              chalk.yellow(
                [
                  '⚠️ Skipping dependency installation',
                  '',
                  'Important: You will need to:',
                  '1. Install dependencies manually before starting development',
                  '2. Run the command in the project directory:',
                  chalk.dim('   pnpm install'),
                  '',
                  'Note: Some features may not work until dependencies are installed',
                  'We recommend running pnpm install before starting development.',
                  '',
                  chalk.dim(`Project directory: ${setupResult.path}`),
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
            message: 'Continue with setup (without installing dependencies)?',
            initialValue: false,
          });

          if (!proceed || isCancel(proceed)) {
            outro(chalk.yellow('Setup cancelled'));
            process.exit(0);
          }
        } else {
          const s = spinner();
          s.start('Installing project dependencies...');

          try {
            execSync('pnpm install', {
              stdio: 'inherit',
              cwd: setupResult.path,
            });
            s.stop('Dependencies installed successfully');
          } catch (error) {
            s.stop(chalk.red(`Failed to install dependencies: ${error.message}`));
            const action = await select({
              message: 'How would you like to proceed?',
              options: [
                { value: 'retry', label: 'Retry Installation', hint: 'Try again' },
                {
                  value: 'skip',
                  label: 'Skip Installation',
                  hint: 'Continue without dependencies',
                },
                { value: 'cancel', label: 'Cancel Setup', hint: 'Exit process' },
              ],
            });

            if (action === 'cancel' || isCancel(action)) {
              outro(chalk.yellow('Setup cancelled'));
              process.exit(0);
            }

            if (action === 'retry') {
              process.argv[2] = 'setup';
              return main();
            }

            if (action === 'skip') {
              console.log(
                boxen(
                  chalk.yellow(
                    [
                      '⚠️ Proceeding without dependencies',
                      '',
                      'Remember to install them manually using:',
                      chalk.dim(`cd ${setupResult.path}`),
                      chalk.dim('pnpm install'),
                      '',
                      'Some features may not work until dependencies are installed.',
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

        await setupCommand({
          projectRoot: setupResult.path,
          skipCompletion: true,
        });

        await devCommand({ projectRoot: setupResult.path });
        await runPostSetupTasks(setupResult.path, depChoice !== 'skip');
        await showFinalOptions(setupResult.path);
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
        await runPostSetupTasks(projectRoot, true);
        await showFinalOptions(projectRoot);
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
