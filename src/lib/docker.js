import { execSync } from 'node:child_process';
import retry from 'async-retry';
import chalk from 'chalk';
import { isCancel, outro, select } from '@clack/prompts';
import { createSpinner } from './ui';
import boxen from 'boxen';

export async function selectDockerOperation() {
  console.log(
    boxen(
      chalk.yellow(
        [
          '⚠️  Docker Initialization Options',
          'NOTE: Press "Enter" if it looks stuck!!',
          '',
          '• Fresh Start: Removes all containers and volumes, starts fresh',
          '• Use Existing: Attempts to use existing containers if healthy',
          '• Reinitialize: Keeps volumes but recreates containers',
          '• Manual Setup: Skip automated setup (Advanced)',
          '',
          '⚡ Note: If automated setup fails, you can:',
          '1. Run docker-compose manually: docker-compose -f docker-compose.dev.yml up -d',
          '2. Check container status: docker ps',
          '3. View logs: docker logs <container-name>',
          '4. Return here after manual setup',
          '',
          '💡 Tip: Manual setup recommended if experiencing issues with automated setup',
        ].join('\n'),
      ),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'yellow',
        title: '🔧 Setup Guide',
        titleAlignment: 'center',
      },
    ),
  );

  const choice = await select({
    message: 'Choose Docker operation mode:',
    options: [
      {
        value: 'fresh',
        label: 'Fresh Start',
        hint: 'Remove everything and start fresh',
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
      {
        value: 'manual',
        label: 'Manual Setup',
        hint: 'Skip automated setup (Advanced)',
      },
    ],
  });

  if (isCancel(choice)) {
    outro(chalk.yellow('Operation cancelled'));
    process.exit(0);
  }

  if (choice === 'manual') {
    console.log(
      boxen(
        chalk.cyan(
          [
            '📝 Manual Setup Instructions:',
            '',
            '🔵 First Time Setup:',
            '1. Create docker network (if not exists):',
            chalk.white(
              '   docker network create zephyr_dev_network --label com.docker.compose.network=dev_network',
            ),
            '',
            '2. Initialize database and storage:',
            chalk.white('   docker-compose -f docker-compose.dev.yml --profile init up -d'),
            chalk.white('   docker-compose -f docker-compose.dev.yml up postgres-init -d'),
            chalk.white('   docker-compose -f docker-compose.dev.yml up prisma-migrate -d'),
            chalk.white('   docker-compose -f docker-compose.dev.yml up minio-init -d'),
            '',
            '3. Wait for initialization to complete:',
            chalk.white('   docker logs -f zephyr-prisma-migrate'),
            chalk.white('   docker logs -f zephyr-postgres-init'),
            chalk.white('   docker logs -f zephyr-minio-init'),
            '',
            '🔵 Starting Services:',
            '1. Start all services:',
            chalk.white('   docker-compose -f docker-compose.dev.yml up -d'),
            '',
            '2. Check container status:',
            chalk.white('   docker ps'),
            '',
            '3. View specific container logs:',
            chalk.white('   docker logs <container-name>'),
            chalk.dim('   Example: docker logs zephyr-postgres-dev'),
            '',
            '🔵 Troubleshooting:',
            '• If services fail to start:',
            chalk.white('   docker-compose -f docker-compose.dev.yml down'),
            chalk.white('   docker system prune -f  # Clean up unused resources'),
            chalk.white('   docker volume prune -f  # Optional: Remove all volumes'),
            '',
            '• Check service logs for errors:',
            chalk.white('   docker logs -f <container-name>'),
            '',
            '5. Once containers are running, return here and select "Use Existing"',
            '',
            '⚠️  Make sure all containers are healthy before continuing!',
            chalk.dim('Look for "healthy" status in docker ps output'),
          ].join('\n'),
        ),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'cyan',
          title: '🛠️ Manual Setup Guide',
          titleAlignment: 'center',
        },
      ),
    );

    const action = await select({
      message: 'What would you like to do?',
      options: [
        { value: 'check', label: 'Check Container Status', hint: 'View current container state' },
        { value: 'logs', label: 'View Init Logs', hint: 'Check initialization progress' },
        { value: 'continue', label: 'Continue Setup', hint: 'Skip container initialization' },
        { value: 'exit', label: 'Exit', hint: 'Exit setup process' },
      ],
    });

    if (isCancel(action) || action === 'exit') {
      outro(chalk.yellow('Setup cancelled - Return after manual container setup'));
      process.exit(0);
    }

    if (action === 'check') {
      const spinner = createSpinner('Checking container status...');
      spinner.start();
      try {
        const status = execSync('docker ps', { stdio: 'pipe' }).toString();
        spinner.stop();
        console.log('\nContainer Status:');
        console.log(chalk.dim(status));
      } catch (error) {
        spinner.fail('Failed to check container status');
        console.error(chalk.red(error.message));
      }
    }

    if (action === 'logs') {
      const spinner = createSpinner('Fetching initialization logs...');
      spinner.start();
      try {
        const initContainers = [
          'zephyr-prisma-migrate',
          'zephyr-postgres-init',
          'zephyr-minio-init',
        ];

        for (const container of initContainers) {
          try {
            const logs = execSync(`docker logs ${container} 2>&1`, { stdio: 'pipe' }).toString();
            console.log(chalk.cyan(`\n📄 Logs for ${container}:`));
            console.log(chalk.dim(logs));
          } catch (error) {
            console.log(chalk.yellow(`\n⚠️  No logs available for ${container}`));
          }
        }
        spinner.stop();
      } catch (error) {
        spinner.fail('Failed to fetch logs');
        console.error(chalk.red(error.message));
      }
    }

    return 'manual';
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

export async function createNetwork() {
  const spinner = createSpinner('Setting up Docker network...');
  spinner.start();

  try {
    // Check if network exists
    const networks = execSync('docker network ls --format "{{.Name}}"', {
      stdio: 'pipe',
    })
      .toString()
      .split('\n');

    const networkName = 'zephyr_dev_network';

    if (networks.includes(networkName)) {
      try {
        // Check network labels
        const networkInfo = JSON.parse(
          execSync(`docker network inspect ${networkName}`, { stdio: 'pipe' }).toString(),
        )[0];

        const hasCorrectLabels =
          networkInfo.Labels && networkInfo.Labels['com.docker.compose.network'] === 'dev_network';

        if (!hasCorrectLabels) {
          // Only try to remove if network exists
          const networkExists = execSync('docker network ls --format "{{.Name}}"', {
            stdio: 'pipe',
          })
            .toString()
            .split('\n')
            .includes(networkName);

          if (networkExists) {
            // Check if network is in use
            const containersUsingNetwork = execSync(
              `docker network inspect -f '{{range .Containers}}{{.Name}} {{end}}' ${networkName}`,
              { stdio: 'pipe' },
            )
              .toString()
              .trim();

            if (containersUsingNetwork) {
              spinner.warn('Network in use by containers, skipping recreation');
              return;
            }

            execSync(`docker network rm ${networkName}`, { stdio: 'pipe' });
          }
        } else {
          spinner.succeed('Docker network already exists with correct configuration');
          return;
        }
      } catch (error) {
        if (!error.message.includes('No such network')) {
          spinner.fail(`Network check failed: ${error.message}`);
          throw error;
        }
      }
    }

    execSync(
      `docker network create ${networkName} --label com.docker.compose.network=dev_network`,
      { stdio: 'pipe' },
    );

    spinner.succeed('Docker network created successfully');
  } catch (error) {
    if (error.message.includes('network with name zephyr_dev_network already exists')) {
      spinner.succeed('Using existing Docker network');
      return;
    }

    spinner.fail(`Failed to setup Docker network: ${error.message}`);
    throw error;
  }
}

export async function waitForContainer(container, status, options = {}) {
  const { timeout = 30000, interval = 2000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const info = JSON.parse(
        execSync(`docker inspect ${container}`, { stdio: 'pipe' }).toString(),
      )[0];

      if (status === 'healthy' && info.State.Health && info.State.Health.Status === 'healthy') {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    } catch (error) {
      if (Date.now() - startTime >= timeout) {
        throw new Error(`Timeout waiting for ${container} to become ${status}`);
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  throw new Error(`Timeout waiting for ${container} to become ${status}`);
}
