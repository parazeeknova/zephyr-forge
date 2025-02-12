import { select, confirm, text, isCancel, outro } from '@clack/prompts';
import { execSync } from 'node:child_process';
import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import boxen from 'boxen';
import { createSpinner } from './ui.js';
import { cloneRepository } from './utils.js';

export async function handleDirectorySetup(targetDir) {
  if (await fs.pathExists(targetDir)) {
    return await handleExistingDirectory(targetDir);
  }
  return await handleNewDirectory(targetDir);
}

async function handleExistingDirectory(targetDir) {
  const isGitRepo = await fs.pathExists(path.join(targetDir, '.git'));
  let isDirty = false;

  if (isGitRepo) {
    try {
      execSync('git status --porcelain', { cwd: targetDir, stdio: 'pipe' });
      const status = execSync('git status --porcelain', { cwd: targetDir }).toString();
      isDirty = status.length > 0;
    } catch (error) {
      isDirty = true;
    }
  }

  console.log(
    boxen(
      chalk.yellow(
        [
          'Directory already exists!',
          '',
          isGitRepo ? '📁 This is a Git repository' : '📁 This is not a Git repository',
          isDirty ? '⚠️  Repository has uncommitted changes' : '',
          '',
          'Options:',
          '1. Overwrite - Delete everything and start fresh',
          '2. Continue - Use existing directory (may cause issues)',
          '3. Cancel - Stop the setup process',
        ]
          .filter(Boolean)
          .join('\n'),
      ),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'yellow',
      },
    ),
  );

  const action = await select({
    message: 'How would you like to proceed?',
    options: [
      { value: 'overwrite', label: 'Overwrite', hint: 'Delete everything and start fresh' },
      { value: 'continue', label: 'Continue', hint: 'Use existing directory' },
      { value: 'cancel', label: 'Cancel', hint: 'Stop setup process' },
    ],
  });

  if (isCancel(action) || action === 'cancel') {
    outro(chalk.yellow('Operation cancelled'));
    process.exit(0);
  }

  if (action === 'overwrite') {
    return await handleOverwrite(targetDir);
  }
  return await handleContinue(targetDir);
}

async function handleOverwrite(targetDir) {
  const s = createSpinner('Removing existing directory...');
  s.start();
  try {
    await fs.remove(targetDir);
    s.succeed('Directory removed successfully');
  } catch (error) {
    s.fail(`Failed to remove directory: ${error.message}`);
    throw error;
  }

  return await handleNewDirectory(targetDir);
}

async function handleContinue(targetDir) {
  console.log(
    boxen(
      chalk.yellow(
        [
          '⚠️  Warning: Using existing directory',
          '',
          'This may cause issues if the directory structure is incorrect',
          'or if there are conflicting files.',
          '',
          'Recommended: Commit or backup your changes before proceeding.',
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

  const proceed = await confirm({
    message: 'Are you sure you want to continue?',
    initialValue: false,
  });

  if (isCancel(proceed) || !proceed) {
    outro(chalk.yellow('Operation cancelled'));
    process.exit(0);
  }

  return { type: 'existing', path: targetDir };
}

async function handleNewDirectory(targetDir) {
  const s = createSpinner(`Cloning Zephyr to ${chalk.blue(targetDir)}...`);
  s.start();
  try {
    await cloneRepository(targetDir);
    s.succeed('Repository cloned successfully');
    return { type: 'new', path: targetDir };
  } catch (error) {
    s.fail(chalk.red(`Failed to clone repository: ${error.message}`));
    throw error;
  }
}

export async function ensureParentDirectory(targetDir) {
  const parentDir = path.dirname(targetDir);
  if (!(await fs.pathExists(parentDir))) {
    const createDir = await confirm({
      message: `Directory ${parentDir} doesn't exist. Create it?`,
      initialValue: true,
    });

    if (isCancel(createDir) || !createDir) {
      outro(chalk.yellow('Operation cancelled'));
      process.exit(0);
    }

    await fs.ensureDir(parentDir);
  }
}
