import { execSync, spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import chalk from 'chalk';
import retry from 'async-retry';
import {
  createSpinner,
  showInitializationProgress,
  createContainerStatusTable,
  getContainerStats,
} from './ui.js';
import dockerNames from 'docker-names';
import debug from 'debug';
import { selectDockerOperation, createNetwork, waitForContainer } from './docker.js';
import boxen from 'boxen';
import { confirm } from '@clack/prompts';

const INIT_STEPS = {
  CLEANUP: 1,
  NETWORK: 2,
  POSTGRES: 3,
  REDIS: 4,
  MINIO: 5,
  PRISMA: 6,
  FINAL: 7,
};

const SERVICES = {
  PostgreSQL: {
    name: 'PostgreSQL',
    container: 'zephyr-postgres-dev',
    healthCheck: 'docker exec zephyr-postgres-dev pg_isready -U postgres -d zephyr',
    url: 'localhost:5433',
    initContainer: 'zephyr-postgres-init',
  },
  Redis: {
    name: 'Redis',
    container: 'zephyr-redis-dev',
    healthCheck: 'docker exec zephyr-redis-dev redis-cli -a zephyrredis ping',
    url: 'localhost:6379',
  },
  MinIO: {
    name: 'MinIO',
    container: 'zephyr-minio-dev',
    url: 'http://localhost:9000',
    initContainer: 'zephyr-minio-init',
  },
  PrismaMigrate: {
    name: 'Prisma',
    container: 'zephyr-prisma-migrate',
    isInit: true,
  },
};

const log = debug('zephyr:docker');

async function spawnDockerCommand(command, args, options = {}) {
  const { silent = false, logPrefix = '' } = options;

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, COMPOSE_DOCKER_CLI_BUILD: '1', DOCKER_BUILDKIT: '1' },
    });

    // biome-ignore lint/style/useConst: This is a function that needs to be mutable
    let output = [];
    // biome-ignore lint/style/useConst: This is a function that needs to be mutable
    let errorOutput = [];
    let currentLine = '';

    if (!silent) process.stdout.write('\x1B[s');

    const processStream = (data, isError = false) => {
      const lines = (currentLine + data.toString()).split('\n');
      currentLine = lines.pop() || '';

      lines.forEach((line) => {
        if (line.trim()) {
          const logLine = `${logPrefix}${line.trim()}`;
          if (isError) {
            errorOutput.push(logLine);
            if (!silent) process.stdout.write(`\x1B[u\x1B[2B\n${chalk.red(logLine)}`);
          } else {
            output.push(logLine);
            if (!silent) process.stdout.write(`\x1B[u\x1B[2B\n${chalk.dim(logLine)}`);
          }
        }
      });
    };

    proc.stdout.on('data', (data) => processStream(data));
    proc.stderr.on('data', (data) => processStream(data, true));

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ output, errorOutput });
      } else {
        const error = new Error('Command failed');
        error.code = code;
        error.output = output;
        error.errorOutput = errorOutput;
        error.command = `${command} ${args.join(' ')}`;
        reject(error);
      }
    });

    proc.on('error', (error) => {
      error.output = output;
      error.errorOutput = errorOutput;
      error.command = `${command} ${args.join(' ')}`;
      reject(error);
    });
  });
}

export async function checkContainerStatus() {
  const spinner = createSpinner('Checking container status...');
  spinner.start();
  const results = {
    needsInit: false,
    running: [],
    stopped: [],
    missing: [],
    initRequired: [],
    services: {},
  };

  try {
    const containersJson = execSync('docker ps -a --format "{{json .}}"', { stdio: 'pipe' })
      .toString()
      .split('\n')
      .filter(Boolean);

    const containers = containersJson.map((json) => JSON.parse(json));

    console.log(createContainerStatusTable(containers));
    const containerStatuses = execSync('docker ps -a --format "{{.Names}},{{.Status}}"', {
      stdio: 'pipe',
    })
      .toString()
      .split('\n')
      .filter(Boolean);

    for (const [serviceName, service] of Object.entries(SERVICES)) {
      const containerInfo = containerStatuses.find((c) => c.includes(service.container));
      const containerDetails = containers.find((c) => c.Names.includes(`/${service.container}`));
      let stats = null;
      if (containerDetails && containerDetails.State === 'running') {
        try {
          stats = await getContainerStats(containerDetails.ID);
        } catch (error) {
          console.log(
            chalk.yellow(`Warning: Could not get stats for ${service.name}: ${error.message}`),
          );
        }
      }

      results.services[serviceName] = {
        status: !containerInfo ? 'missing' : containerInfo.includes('Up') ? 'running' : 'stopped',
        container: service.container,
        health: !containerInfo
          ? 'missing'
          : containerInfo.includes('healthy')
            ? 'healthy'
            : 'unhealthy',
        stats: stats,
        details: containerDetails || null,
      };

      if (!containerInfo) {
        results.missing.push(serviceName);
        results.needsInit = true;
      } else {
        const isRunning = containerInfo.includes('Up');
        if (isRunning) {
          results.running.push(serviceName);
        } else {
          results.stopped.push(serviceName);
          results.needsInit = true;
        }
      }

      if (service.initContainer) {
        const initInfo = containerStatuses.find((c) => c.includes(service.initContainer));
        if (!initInfo || !initInfo.includes('Exited (0)')) {
          results.initRequired.push(serviceName);
          results.needsInit = true;
        }
      }
    }

    const summary = [
      '',
      chalk.blue('Container Summary:'),
      chalk.green(`Running: ${results.running.length}`),
      chalk.red(`Stopped: ${results.stopped.length}`),
      chalk.yellow(`Missing: ${results.missing.length}`),
      results.needsInit
        ? chalk.yellow('⚠️  Initialization required')
        : chalk.green('✓ All services initialized'),
      '',
    ].join('\n');

    console.log(
      boxen(summary, {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: results.needsInit ? 'yellow' : 'green',
      }),
    );

    if (results.needsInit || results.stopped.length > 0) {
      const issues = [];

      if (results.missing.length > 0) {
        issues.push(chalk.yellow(`Missing containers: ${results.missing.join(', ')}`));
      }

      if (results.stopped.length > 0) {
        issues.push(chalk.red(`Stopped containers: ${results.stopped.join(', ')}`));
      }

      if (results.initRequired.length > 0) {
        issues.push(chalk.yellow(`Needs initialization: ${results.initRequired.join(', ')}`));
      }

      console.log(
        boxen(issues.join('\n'), {
          title: '⚠️  Issues Found',
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'yellow',
        }),
      );
    }

    spinner.succeed('Container status checked');
    return results;
  } catch (error) {
    spinner.fail(`Failed to check container status: ${error.message}`);

    console.error(chalk.red('\nError Details:'));
    if (error.stack) {
      console.error(chalk.dim(error.stack));
    }

    try {
      execSync('docker info', { stdio: 'pipe' });
    } catch (dockerError) {
      console.error(
        chalk.yellow('\nDocker daemon might not be running. Please check if Docker is started.'),
      );
    }

    throw new Error(`Container status check failed: ${error.message}`);
  }
}

export async function checkServices(options = {}) {
  const results = {
    ready: true,
    services: {},
  };

  for (const [key, service] of Object.entries(SERVICES)) {
    const serviceSpinner = createSpinner(`Checking ${service.name}...`);
    serviceSpinner.start();

    try {
      await retry(
        async () => {
          if (service.skipHealthCheck) {
            await checkPort(service.url);
          } else if (service.healthCheck) {
            execSync(service.healthCheck, { stdio: 'pipe' });
          }
          results.services[key] = { status: 'ready', url: service.url };
        },
        {
          retries: 5,
          minTimeout: 1000,
          maxTimeout: 3000,
          onRetry: (error, attempt) => {
            serviceSpinner.text = `Retrying ${service.name} (${attempt}/5)...`;
          },
        },
      );
      serviceSpinner.succeed(`${service.name} is ready`);
    } catch (error) {
      results.ready = false;
      results.services[key] = {
        status: 'error',
        error: error.message,
        url: service.url,
      };
      serviceSpinner.fail(chalk.red(`${service.name} failed health check`));
    }
  }
  return results;
}

export async function cleanupServices() {
  const spinner = createSpinner('Cleaning up existing services...');
  spinner.start();

  try {
    execSync('docker-compose -f docker-compose.dev.yml down', {
      stdio: 'pipe',
    });

    const volumes = execSync('docker volume ls --format "{{.Name}}"', {
      stdio: 'pipe',
    })
      .toString()
      .split('\n');

    const volumesToRemove = [
      'zephyr_postgres_data_dev',
      'zephyr_redis_data_dev',
      'zephyr_minio_data_dev',
    ].filter((volume) => volumes.includes(volume));

    if (volumesToRemove.length > 0) {
      execSync(`docker volume rm ${volumesToRemove.join(' ')}`, {
        stdio: 'pipe',
      });
    }

    spinner.succeed('Services cleaned up successfully');
  } catch (error) {
    if (error.message.includes('no such volume')) {
      spinner.succeed('No existing volumes to clean up');
      return;
    }
    spinner.fail(chalk.red('Failed to cleanup services'));
    throw error;
  }
}

export async function initializeServices(options = {}) {
  const { showProgress = true } = options;
  const totalSteps = Object.keys(INIT_STEPS).length;
  const maxRetries = 3;

  console.clear();
  console.log('\n'.repeat(10));

  try {
    const mode = await selectDockerOperation();
    const logPrefix = `[${dockerNames.getRandomName(true)}] `;
    log('Starting initialization in %s mode', mode);

    // Handle manual mode
    if (mode === 'manual') {
      console.log(
        boxen(
          chalk.green(
            [
              '🔄 Checking existing services...',
              '',
              'Skipping automated initialization.',
              'Proceeding with existing container state.',
              '',
              '⚠️  Make sure all required services are running!',
            ].join('\n'),
          ),
          {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'green',
          },
        ),
      );

      const health = await checkServiceHealth();
      if (!health.healthy) {
        console.log(
          boxen(
            chalk.yellow(
              [
                '⚠️  Service Health Check Failed',
                '',
                'Some services are not healthy or missing.',
                'You may want to:',
                '',
                '1. Check container logs for errors',
                '2. Restart unhealthy containers',
                '3. Run setup again with "Fresh Start"',
                '',
                'Issues:',
                ...health.issues.map((issue) => `• ${issue}`),
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
          message: 'Continue anyway? (Not recommended)',
          initialValue: false,
        });

        if (!proceed) {
          throw new Error('Service health check failed - Please fix issues and try again');
        }
      }
      return { status: 'manual', mode, health };
    }

    // Automated initialization
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (mode === 'fresh' || mode === 'reinit') {
          if (showProgress) {
            process.stdout.write('\x1B[H');
            console.log(
              showInitializationProgress(1, totalSteps, 'Cleaning up existing services...'),
            );
          }
          await cleanupServices(mode === 'fresh');
        }

        if (showProgress) {
          process.stdout.write('\x1B[H');
          console.log(showInitializationProgress(2, totalSteps, 'Setting up network...'));
        }
        await createNetwork();
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const services = ['postgres', 'redis', 'minio'];
        const logProcesses = [];
        const initContainers = [];

        for (const [index, service] of services.entries()) {
          if (showProgress) {
            process.stdout.write('\x1B[H');
            console.log(
              showInitializationProgress(
                index + 3,
                totalSteps,
                `Initializing ${service} (Attempt ${attempt}/${maxRetries})...`,
              ),
            );
          }

          try {
            if (mode !== 'existing') {
              await spawnDockerCommand(
                'docker-compose',
                ['-f', 'docker-compose.dev.yml', 'rm', '-f', '-s', `${service}-dev`],
                { logPrefix: `[${service}] `, silent: true },
              );
            }

            await spawnDockerCommand(
              'docker-compose',
              ['-f', 'docker-compose.dev.yml', 'up', '-d', `${service}-dev`],
              { logPrefix: `[${service}] ` },
            );

            if (SERVICES[service]?.initContainer) {
              await spawnDockerCommand(
                'docker-compose',
                [
                  '-f',
                  'docker-compose.dev.yml',
                  '--profile',
                  'init',
                  'up',
                  '-d',
                  `${service}-init`,
                ],
                { logPrefix: `[${service}-init] ` },
              );
              initContainers.push(`${service}-init`);
            }

            await new Promise((resolve) => setTimeout(resolve, 5000));
            logProcesses.push(
              streamContainerLogs(`zephyr-${service}-dev`, { logPrefix: `[${service}] ` }),
            );

            await waitForContainer(`zephyr-${service}-dev`, 'healthy', {
              timeout: 60000,
              interval: 2000,
            });
          } catch (error) {
            throw new ServiceError(service, error);
          }
        }

        // Wait for init containers
        if (initContainers.length > 0) {
          if (showProgress) {
            process.stdout.write('\x1B[H');
            console.log(
              showInitializationProgress(
                totalSteps - 1,
                totalSteps,
                'Waiting for initialization...',
              ),
            );
          }

          for (const container of initContainers) {
            try {
              await waitForContainer(container, 'done', {
                timeout: 120000,
                interval: 5000,
              });
            } catch (error) {
              console.log(chalk.yellow(`Warning: Init container ${container} timed out`));
            }
          }
        }

        // Final verification
        if (showProgress) {
          process.stdout.write('\x1B[H');
          console.log(showInitializationProgress(totalSteps, totalSteps, 'Verifying services...'));
        }

        const health = await checkServiceHealth();
        if (!health.healthy) {
          throw new Error(`Service health check failed:\n${health.issues.join('\n')}`);
        }

        // Cleanup
        logProcesses.forEach((proc) => proc.kill());
        return { status: 'success', mode, health };
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        console.log(chalk.yellow(`\nRetrying initialization (${attempt}/${maxRetries})...`));
        await stopServices().catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  } catch (error) {
    console.error(chalk.red('\nService initialization failed:'));
    console.error(chalk.yellow(error.message));
    throw error;
  }
}

export async function startServices() {
  const spinner = createSpinner('Starting services...');
  spinner.start();

  try {
    execSync('docker-compose -f docker-compose.dev.yml up -d', { stdio: 'pipe' });
    spinner.succeed('Services started successfully');
  } catch (error) {
    spinner.fail(chalk.red('Failed to start services'));
    throw error;
  }
}

class ServiceError extends Error {
  constructor(service, originalError) {
    super(`${service} initialization failed`);
    this.service = service;
    this.details = originalError.message;
    this.originalError = originalError;
  }
}

async function checkPort(url) {
  const [host, port] = url.replace('http://', '').split(':');
  const net = require('node:net');

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();

    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Timeout connecting to ${host}:${port}`));
    }, 1000);

    socket.connect(Number.parseInt(port), host, () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve();
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export async function waitForInitServices(maxAttempts = 60) {
  const spinner = createSpinner('Waiting for initialization services...');
  spinner.start();

  try {
    await retry(
      async () => {
        const logs = execSync('docker logs zephyr-prisma-migrate', { stdio: 'pipe' }).toString();

        if (logs.includes('🎉 Database initialization complete')) {
          return true;
        }

        if (logs.match(/Error:|error:|prisma:error/)) {
          throw new Error('Database initialization failed');
        }

        throw new Error('Still initializing');
      },
      {
        retries: maxAttempts,
        minTimeout: 1000,
        maxTimeout: 3000,
        onRetry: (error, attempt) => {
          spinner.text = `Waiting for initialization (${attempt}/${maxAttempts})...`;
        },
      },
    );

    spinner.succeed('Initialization complete');
    return true;
  } catch (error) {
    spinner.fail(chalk.red('Initialization failed'));
    return false;
  }
}

async function streamContainerLogs(container) {
  const proc = spawn('docker', ['logs', '-f', container], { stdio: ['ignore', 'pipe', 'pipe'] });

  proc.stdout.on('data', (data) => {
    process.stdout.write(`\x1B[u\x1B[2B\n${chalk.dim(data.toString())}`);
  });

  proc.stderr.on('data', (data) => {
    process.stdout.write(`\x1B[u\x1B[2B\n${chalk.yellow(data.toString())}`);
  });

  return proc;
}

export async function verifyServices() {
  const services = await checkServices();

  for (const [serviceName, info] of Object.entries(services.services)) {
    if (info.status === 'ready') {
      process.stdout.write(`\x1B[u\x1B[2B\n${chalk.green(`✓ ${serviceName} is ready`)}`);
    } else {
      process.stdout.write(`\x1B[u\x1B[2B\n${chalk.red(`✗ ${serviceName} failed: ${info.error}`)}`);
    }
  }

  if (!services.ready) {
    throw new Error('Service verification failed');
  }

  return services;
}

export async function stopServices() {
  const spinner = createSpinner('Stopping services...');
  spinner.start();

  try {
    execSync('docker-compose -f docker-compose.dev.yml down', { stdio: 'pipe' });
    spinner.succeed('Services stopped successfully');
  } catch (error) {
    spinner.fail(chalk.red('Failed to stop services'));
    throw error;
  }
}

export async function checkServiceHealth() {
  const spinner = createSpinner('Checking service health...');
  spinner.start();

  const results = {
    healthy: true,
    issues: [],
    services: {},
  };

  try {
    for (const [serviceName, service] of Object.entries(SERVICES)) {
      if (service.healthCheck) {
        try {
          execSync(service.healthCheck, { stdio: 'pipe' });
          results.services[serviceName] = { status: 'healthy' };
        } catch (error) {
          results.healthy = false;
          results.issues.push(`${service.name}: ${error.message}`);
          results.services[serviceName] = {
            status: 'unhealthy',
            error: error.message,
          };
        }
      } else if (service.url && !service.isInit) {
        try {
          await checkPort(service.url);
          results.services[serviceName] = { status: 'healthy' };
        } catch (error) {
          results.healthy = false;
          results.issues.push(`${service.name}: Port check failed - ${error.message}`);
          results.services[serviceName] = {
            status: 'unhealthy',
            error: error.message,
          };
        }
      }
    }

    spinner.succeed(results.healthy ? 'All services are healthy' : 'Health check failed');
    return results;
  } catch (error) {
    spinner.fail(chalk.red('Health check failed'));
    throw error;
  }
}
