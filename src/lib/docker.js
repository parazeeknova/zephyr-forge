import { execSync } from 'node:child_process';
import retry from 'async-retry';

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
