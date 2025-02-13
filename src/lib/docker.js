import { execSync } from 'node:child_process';
import retry from 'async-retry';
import chalk from 'chalk';
import { isCancel, outro, select } from '@clack/prompts';

export async function selectDockerOperation() {
  const choice = await select({
    message: 'Choose Docker operation mode:',
    options: [
      {
        value: 'fresh',
        label: 'Fresh Start',
        hint: 'Remove everything and start from scratch',
      },
      {
        value: 'existing',
        label: 'Use Existing',
        hint: 'Keep existing containers and volumes',
      },
      {
        value: 'reinit',
        label: 'Reinitialize',
        hint: 'Keep volumes but reinit containers',
      },
    ],
  });

  if (isCancel(choice)) {
    outro(chalk.yellow('Operation cancelled'));
    process.exit(0);
  }

  return choice;
}

export async function checkDocker() {
  return retry(
    async (bail) => {
      try {
        execSync('docker info', { stdio: 'pipe' });
        return { installed: true };
      } catch (error) {
        if (error.message.includes('Cannot connect to the Docker daemon')) {
          bail(new Error('Docker is not running. Please start Docker and try again.'));
          return;
        }
        throw error;
      }
    },
    {
      retries: 3,
      minTimeout: 1000,
    },
  );
}

export async function startDockerServices() {
  return retry(
    async (bail) => {
      try {
        execSync('docker-compose -f docker-compose.dev.yml up -d', {
          stdio: 'pipe',
        });
        return true;
      } catch (error) {
        if (error.message.includes("Couldn't connect to Docker daemon")) {
          bail(new Error('Docker daemon is not running'));
          return;
        }
        throw error;
      }
    },
    {
      retries: 3,
      minTimeout: 1000,
    },
  );
}
