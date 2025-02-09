import { outro, select, text, confirm } from '@clack/prompts';
import { execSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { isCancel } from '@clack/prompts';
import fs from 'fs-extra';
import path from 'node:path';
import gradient from 'gradient-string';
import figlet from 'figlet';
import retry from 'async-retry';
import ora from 'ora';
import logUpdate from 'log-update';
import boxen from 'boxen';
import chalk from 'chalk';
import terminalLink from 'terminal-link';

const sleep = (ms = 1000) => setTimeout(ms);

const BOXEN_CONFIG = {
  padding: 1,
  margin: 1,
  borderStyle: 'round',
  borderColor: 'cyan',
};

async function displayBanner() {
  console.clear();
  const title = figlet.textSync('ZEPHYR', {
    font: 'ANSI Shadow',
    horizontalLayout: 'fitted',
  });

  const gradientTitle = gradient.pastel.multiline(title);
  const boxedTitle = boxen(gradientTitle, {
    ...BOXEN_CONFIG,
    title: '🚀 Welcome',
    titleAlignment: 'center',
  });

  console.log(boxedTitle);

  const subtitle = chalk.cyan('Social Media Aggregator');
  const version = `Version ${chalk.green('1.0.0')} by ${terminalLink('parazeeknova', 'https://github.com/parazeeknova')}`;

  console.log(
    boxen(`${subtitle}\n${version}`, {
      ...BOXEN_CONFIG,
      borderColor: 'green',
    }),
  );

  await sleep(1000);
}

async function retryOperation(operation, options = {}) {
  const defaultOptions = {
    retries: 3,
    minTimeout: 1000,
    maxTimeout: 3000,
    onRetry: (error, attempt) => {
      console.log(
        boxen(
          `${chalk.yellow(`Attempt ${attempt}`)}\n${chalk.red(`Error: ${error.message}`)}\n${chalk.blue('Retrying...')}`,
          { ...BOXEN_CONFIG, borderColor: 'yellow' },
        ),
      );
    },
  };

  return retry(
    async (bail, attempt) => {
      try {
        return await operation();
      } catch (error) {
        if (error.message.includes('ENOENT') || error.message.includes('permission denied')) {
          bail(error);
          return;
        }
        throw error;
      }
    },
    { ...defaultOptions, ...options },
  );
}

async function detectPackageManager() {
  const packageManagers = [
    {
      name: 'pnpm',
      command: 'pnpm -v',
      installCmd: 'npm install -g pnpm',
      speed: 'Fastest',
      diskUsage: 'Lowest',
      icon: '🚀',
    },
    {
      name: 'bun',
      command: 'bun -v',
      installCmd: 'npm install -g bun',
      speed: 'Very Fast',
      diskUsage: 'Low',
      icon: '⚡',
    },
    {
      name: 'yarn',
      command: 'yarn -v',
      installCmd: 'npm install -g yarn',
      speed: 'Fast',
      diskUsage: 'Medium',
      icon: '🧶',
    },
    {
      name: 'npm',
      command: 'npm -v',
      installCmd: null,
      speed: 'Standard',
      diskUsage: 'High',
      icon: '📦',
    },
  ];

  const installed = [];
  const notInstalled = [];

  for (const pm of packageManagers) {
    try {
      const version = execSync(pm.command, { stdio: 'pipe' }).toString().trim();
      installed.push({ ...pm, version });
    } catch {
      notInstalled.push(pm);
    }
  }
  return { installed, notInstalled };
}

async function selectPackageManager() {
  console.clear();
  const spinner = ora('Detecting package managers').start();

  const { installed, notInstalled } = await detectPackageManager();
  await sleep(1000);
  spinner.succeed('Package managers detected');

  const choices = installed.map((pm) => ({
    value: pm.name,
    label: `${pm.icon} ${pm.name} v${pm.version}`,
    hint: `${chalk.blue(pm.speed)} | ${chalk.yellow(pm.diskUsage)} disk usage`,
  }));

  console.log(
    boxen(chalk.cyan('Available Package Managers'), { ...BOXEN_CONFIG, borderColor: 'blue' }),
  );

  const packageManager = await select({
    message: 'Select your preferred package manager:',
    options: choices,
  });

  if (isCancel(packageManager)) {
    outro('Installation cancelled. Goodbye! 👋');
    process.exit(0);
  }

  return packageManager;
}

async function checkDependencies() {
  console.clear();
  console.log(boxen(chalk.cyan('Dependency Check'), { ...BOXEN_CONFIG, borderColor: 'blue' }));

  const dependencies = {
    Git: { command: 'git --version', icon: '🔄' },
    Docker: { command: 'docker --version', icon: '🐳' },
    'Node.js': { command: 'node --version', icon: '💚' },
  };

  const results = [];
  for (const [dep, { command, icon }] of Object.entries(dependencies)) {
    const spinner = ora(`${icon} Checking ${dep}...`).start();

    try {
      const version = await retryOperation(async () => {
        return execSync(command, { stdio: 'pipe' }).toString().trim();
      });

      results.push(`${icon} ${dep}: ${chalk.green('✓')} ${version}`);
      spinner.succeed(`${dep} ${chalk.green(version)}`);
    } catch (error) {
      results.push(`${icon} ${dep}: ${chalk.red('✗')} not found`);
      spinner.fail(`${dep} ${chalk.red('not found')}`);

      const shouldContinue = await confirm({
        message: `${dep} not found. Would you like to continue anyway?`,
        initialValue: false,
      });

      if (isCancel(shouldContinue) || !shouldContinue) {
        console.log(
          boxen(chalk.red(`Please install ${dep} to continue`), {
            ...BOXEN_CONFIG,
            borderColor: 'red',
          }),
        );
        process.exit(1);
      }
    }
    await sleep(500);
  }

  console.log(
    boxen(chalk.cyan('Dependency Check Summary:\n\n') + results.join('\n'), {
      ...BOXEN_CONFIG,
      borderColor: 'green',
    }),
  );
  await sleep(1000);
}

async function getInstallLocation() {
  console.clear();
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const currentDir = process.cwd();

  console.log(boxen(chalk.cyan('Installation Location'), { ...BOXEN_CONFIG, borderColor: 'blue' }));

  const locationChoice = await select({
    message: 'Where would you like to install Zephyr?',
    options: [
      { value: path.join(currentDir, 'zephyr'), label: '📂 Current Directory', hint: currentDir },
      { value: path.join(homeDir, 'Downloads/zephyr'), label: '⬇️ Downloads' },
      { value: path.join(homeDir, 'Desktop/zephyr'), label: '🖥️ Desktop' },
      { value: 'custom', label: '🎯 Custom Location' },
    ],
  });

  if (isCancel(locationChoice)) {
    outro('Installation cancelled. Goodbye! 👋');
    process.exit(0);
  }

  if (locationChoice === 'custom') {
    const customPath = await text({
      message: 'Enter custom installation path:',
      validate: (input) => (input.length === 0 ? 'Please enter a valid path' : undefined),
    });

    if (isCancel(customPath)) {
      outro('Installation cancelled. Goodbye! 👋');
      process.exit(0);
    }

    return path.resolve(customPath);
  }

  return locationChoice;
}

async function selectBranch() {
  console.clear();
  console.log(
    boxen(chalk.cyan('Select Installation Branch'), { ...BOXEN_CONFIG, borderColor: 'blue' }),
  );

  const branch = await select({
    message: 'Select installation branch:',
    options: [
      { value: 'main', label: '🌟 main', hint: 'Stable release branch' },
      { value: 'development', label: '🔧 development', hint: 'Development branch (recommended)' },
    ],
  });

  if (isCancel(branch)) {
    outro('Installation cancelled. Goodbye! 👋');
    process.exit(0);
  }

  return branch;
}

async function installZephyr(installDir, packageManager) {
  console.clear();
  console.log(
    boxen(chalk.cyan(`Installing to: ${installDir}\nUsing: ${packageManager}`), {
      ...BOXEN_CONFIG,
      borderColor: 'blue',
    }),
  );

  const progress = {
    total: 5,
    current: 0,
    message: '',
  };

  const updateProgress = () => {
    const bar = '█'.repeat(progress.current) + '░'.repeat(progress.total - progress.current);
    const percentage = Math.round((progress.current / progress.total) * 100);

    logUpdate(
      boxen(
        `${chalk.cyan('Installation Progress')}\n\n${bar} ${percentage}%\n${progress.message}`,
        { ...BOXEN_CONFIG, borderColor: 'yellow' },
      ),
    );
  };

  try {
    if (fs.existsSync(installDir)) {
      progress.message = '🗑️ Cleaning existing directory...';
      progress.current++;
      updateProgress();

      await retryOperation(async () => {
        await fs.remove(installDir);
      });
    }

    const branch = await selectBranch();
    progress.current++;
    progress.message = '📥 Cloning repository...';
    updateProgress();

    await retryOperation(async () => {
      execSync(
        `git clone -b ${branch} https://github.com/parazeeknova/zephyr.git "${installDir}"`,
        {
          stdio: 'pipe',
        },
      );
    });

    process.chdir(installDir);
    progress.current++;
    progress.message = '📦 Installing dependencies...';
    updateProgress();

    await retryOperation(async () => {
      execSync(`${packageManager} install`, { stdio: 'pipe' });
    });

    progress.current++;
    progress.message = '🎉 Finalizing installation...';
    updateProgress();

    await sleep(1000);
    progress.current = progress.total;
    progress.message = '✨ Installation complete!';
    updateProgress();

    await showCompletionMenu(installDir, packageManager);
  } catch (error) {
    logUpdate.clear();
    console.log(
      boxen(chalk.red(`Installation failed: ${error.message}`), {
        ...BOXEN_CONFIG,
        borderColor: 'red',
      }),
    );

    const shouldRetry = await confirm({
      message: 'Would you like to retry the installation?',
      initialValue: true,
    });

    if (shouldRetry) {
      return installZephyr(installDir, packageManager);
    }
    process.exit(1);
  }
}

async function showCompletionMenu(installDir, packageManager) {
  console.clear();
  console.log(
    boxen(chalk.green('🎉 Installation Complete! 🎉'), { ...BOXEN_CONFIG, borderColor: 'green' }),
  );

  const action = await select({
    message: 'What would you like to do next?',
    options: [
      { value: 'code', label: '📝 Open in VS Code' },
      { value: 'folder', label: '📂 Open Folder Location' },
      { value: 'dev', label: '🚀 Start Development Server' },
      { value: 'exit', label: '👋 Exit' },
    ],
  });

  if (isCancel(action)) {
    outro('Installation completed. Goodbye! 👋');
    process.exit(0);
  }

  const spinner = ora('Processing').start();

  try {
    await retryOperation(async () => {
      switch (action) {
        case 'code':
          if (await commandExists('code')) {
            execSync(`code "${installDir}"`, { stdio: 'inherit' });
            spinner.succeed('VS Code opened successfully');
          } else {
            spinner.fail('VS Code not found');
            throw new Error('VS Code is not installed');
          }
          break;
        case 'folder': {
          const command =
            process.platform === 'win32'
              ? 'explorer'
              : process.platform === 'darwin'
                ? 'open'
                : 'xdg-open';
          execSync(`${command} "${installDir}"`, { stdio: 'inherit' });
          spinner.succeed('Folder opened successfully');
          break;
        }
        case 'dev':
          spinner.succeed('Starting development server');
          execSync(`${packageManager} run dev`, { stdio: 'inherit' });
          break;
        case 'exit':
          outro('Thank you for installing Zephyr! 👋');
          break;
      }
    });
  } catch (error) {
    spinner.fail(`Failed: ${error.message}`);
    const retry = await confirm({
      message: 'Would you like to try another action?',
      initialValue: true,
    });

    if (retry) {
      return showCompletionMenu(installDir, packageManager);
    }
  }
}

async function commandExists(command) {
  try {
    execSync(`${command} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (process.argv[2] !== 'init') {
    console.log(
      boxen(chalk.red('Usage: npx zephyr-forge@latest init'), {
        ...BOXEN_CONFIG,
        borderColor: 'red',
      }),
    );
    process.exit(1);
  }

  try {
    await displayBanner();
    await checkDependencies();
    const packageManager = await selectPackageManager();
    const installLocation = await getInstallLocation();
    await installZephyr(installLocation, packageManager);
  } catch (error) {
    console.log(
      boxen(chalk.red(`Fatal error: ${error.message}`), { ...BOXEN_CONFIG, borderColor: 'red' }),
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.log(
    boxen(chalk.red(`Unexpected error: ${error.message}`), { ...BOXEN_CONFIG, borderColor: 'red' }),
  );
  process.exit(1);
});
