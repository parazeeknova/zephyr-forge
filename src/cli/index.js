#!/usr/bin/env node

import { intro, outro, select, text, spinner, note, confirm } from '@clack/prompts';
import { execSync } from 'node:child_process';
import fs from 'fs-extra';
import path from 'node:path';
import gradient from 'gradient-string';
import figlet from 'figlet';
import color from 'picocolors';

const sleep = (ms = 1000) => new Promise((resolve) => setTimeout(resolve, ms));

async function displayBanner() {
  console.clear();
  const title = figlet.textSync('ZEPHYR', {
    font: 'ANSI Shadow',
    horizontalLayout: 'fitted',
  });
  console.log(gradient.pastel.multiline(title));

  intro(color.white('Social Media Aggregator'));
  note(`Version 1.0.0 by ${color.cyan('parazeeknova')}`);
  await sleep(1000);
}

async function detectPackageManager() {
  const packageManagers = [
    {
      name: 'pnpm',
      command: 'pnpm -v',
      installCmd: 'npm install -g pnpm',
      speed: 'Fastest',
      diskUsage: 'Lowest',
    },
    {
      name: 'bun',
      command: 'bun -v',
      installCmd: 'npm install -g bun',
      speed: 'Very Fast',
      diskUsage: 'Low',
    },
    {
      name: 'yarn',
      command: 'yarn -v',
      installCmd: 'npm install -g yarn',
      speed: 'Fast',
      diskUsage: 'Medium',
    },
    {
      name: 'npm',
      command: 'npm -v',
      installCmd: null,
      speed: 'Standard',
      diskUsage: 'High',
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
  const s = spinner();
  s.start('Detecting package managers');

  const { installed, notInstalled } = await detectPackageManager();
  await sleep(1000);
  s.stop('Package managers detected');

  const choices = installed.map((pm) => ({
    value: pm.name,
    label: `${pm.name} v${pm.version}`,
    hint: `${color.blue(pm.speed)} | ${color.yellow(pm.diskUsage)} disk usage`,
  }));

  const packageManager = await select({
    message: 'Select your preferred package manager:',
    options: choices,
  });

  return packageManager;
}

async function checkDependencies() {
  console.clear();
  note('Checking Dependencies');

  const dependencies = {
    Git: 'git --version',
    Docker: 'docker --version',
    'Node.js': 'node --version',
  };

  for (const [dep, command] of Object.entries(dependencies)) {
    const s = spinner();
    s.start(`Checking ${dep}...`);
    await sleep(500);

    try {
      const version = execSync(command, { stdio: 'pipe' }).toString().trim();
      s.stop(`${dep} ${color.green(version)}`);
    } catch (error) {
      s.stop(`${dep} ${color.red('not found')}`);
      note(`Please install ${dep} to continue`, 'error');
      process.exit(1);
    }
  }
  await sleep(1000);
}

async function getInstallLocation() {
  console.clear();
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const currentDir = process.cwd();

  note('Installation Location');

  const locationChoice = await select({
    message: 'Where would you like to install Zephyr?',
    options: [
      { value: path.join(currentDir, 'zephyr'), label: 'Current Directory', hint: currentDir },
      { value: path.join(homeDir, 'Downloads/zephyr'), label: 'Downloads' },
      { value: path.join(homeDir, 'Desktop/zephyr'), label: 'Desktop' },
      { value: 'custom', label: 'Custom Location' },
    ],
  });

  if (locationChoice === 'custom') {
    const customPath = await text({
      message: 'Enter custom installation path:',
      validate: (input) => (input.length === 0 ? 'Please enter a valid path' : undefined),
    });
    return path.resolve(customPath);
  }

  return locationChoice;
}

async function selectBranch() {
  console.clear();
  note('Select Branch');

  return select({
    message: 'Select installation branch:',
    options: [
      { value: 'main', label: 'main', hint: 'Stable release branch' },
      { value: 'development', label: 'development', hint: 'Development branch (recommended)' },
    ],
  });
}

async function installZephyr(installDir, packageManager) {
  console.clear();
  note(`Installing to: ${color.cyan(installDir)}\nUsing: ${color.cyan(packageManager)}`);

  if (fs.existsSync(installDir)) {
    const s = spinner();
    s.start('Cleaning existing directory');
    await fs.remove(installDir);
    await sleep(500);
    s.stop('Cleaned existing directory');
  }

  try {
    const branch = await selectBranch();
    const s = spinner();

    s.start('Cloning repository');
    execSync(`git clone -b ${branch} https://github.com/parazeeknova/zephyr.git "${installDir}"`, {
      stdio: 'ignore',
    });
    await sleep(1000);
    s.stop('Repository cloned');

    process.chdir(installDir);

    s.start('Installing dependencies');
    execSync(`${packageManager} install`, { stdio: 'ignore' });
    await sleep(1000);
    s.stop('Dependencies installed');

    await showCompletionMenu(installDir, packageManager);
  } catch (error) {
    note(error.message, 'error');
    process.exit(1);
  }
}

async function showCompletionMenu(installDir, packageManager) {
  console.clear();
  note('Installation Complete! 🎉');

  const action = await select({
    message: 'What would you like to do next?',
    options: [
      { value: 'code', label: 'Open in VS Code', hint: '📝' },
      { value: 'folder', label: 'Open Folder Location', hint: '📂' },
      { value: 'dev', label: 'Start Development Server', hint: '🚀' },
      { value: 'exit', label: 'Exit', hint: '👋' },
    ],
  });

  const s = spinner();
  s.start('Processing');
  await sleep(500);

  try {
    switch (action) {
      case 'code':
        if (commandExists('code')) {
          execSync(`code "${installDir}"`, { stdio: 'inherit' });
          s.stop('Opening VS Code');
        } else {
          s.stop('VS Code not found');
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
        s.stop('Opening folder');
        break;
      }
      case 'dev':
        s.stop('Starting development server');
        execSync(`${packageManager} run dev`, { stdio: 'inherit' });
        break;
      case 'exit':
        outro('Thank you for installing Zephyr! 👋');
        break;
    }
  } catch (error) {
    s.stop(`Failed: ${error.message}`);
  }
}

function commandExists(command) {
  try {
    execSync(`${command} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (process.argv[2] !== 'init') {
    note('Usage: npx zephyrforge init', 'error');
    process.exit(1);
  }

  await displayBanner();
  await checkDependencies();
  const packageManager = await selectPackageManager();
  const installLocation = await getInstallLocation();
  await installZephyr(installLocation, packageManager);
}

main().catch((error) => {
  note(error.message, 'error');
  process.exit(1);
});
