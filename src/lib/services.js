import { execSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import chalk from 'chalk';
import retry from 'async-retry';
import ora from 'ora';
import { showInitializationProgress } from './ui.js';

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

const createSpinner = (text) => {
  const spinner = ora({
    text,
    color: 'cyan',
    spinner: 'dots',
  });
  return spinner;
};

export async function checkContainerStatus() {
  const spinner = createSpinner('Checking container status...');
  spinner.start();
  const results = {
    needsInit: false,
    running: [],
    stopped: [],
    missing: [],
    initRequired: [],
  };

  try {
    const containers = execSync('docker ps -a --format "{{.Names}},{{.Status}}"', {
      stdio: 'pipe',
    })
      .toString()
      .split('\n')
      .filter(Boolean);

    for (const [serviceName, service] of Object.entries(SERVICES)) {
      const containerInfo = containers.find((c) => c.includes(service.container));

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
        const initInfo = containers.find((c) => c.includes(service.initContainer));
        if (!initInfo || !initInfo.includes('Exited (0)')) {
          results.initRequired.push(serviceName);
          results.needsInit = true;
        }
      }
    }

    spinner.succeed('Container status checked');
    return results;
  } catch (error) {
    spinner.fail(`Failed to check container status: ${error.message}`);
    throw error;
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
    execSync('docker-compose -f docker-compose.dev.yml down -v', { stdio: 'pipe' });
    execSync(
      'docker volume rm zephyr_postgres_data_dev zephyr_redis_data_dev zephyr_minio_data_dev',
      {
        stdio: 'pipe',
      },
    );
    spinner.succeed('Services cleaned up successfully');
  } catch (error) {
    spinner.fail(chalk.red('Failed to cleanup services'));
    throw error;
  }
}

export async function initializeServices(options = {}) {
  const { showProgress = true } = options;
  const spinner = createSpinner('Initializing services...');
  spinner.start();
  const totalSteps = Object.keys(INIT_STEPS).length;

  try {
    // Step 1: Cleanup
    if (showProgress) {
      console.log(showInitializationProgress(1, totalSteps, 'Cleaning up existing services...'));
    }
    await cleanupServices();

    // Step 2: Create Docker network
    if (showProgress) {
      console.log(showInitializationProgress(2, totalSteps, 'Creating Docker network...'));
    }
    await createNetwork();

    // Step 3: Initialize PostgreSQL
    if (showProgress) {
      console.log(showInitializationProgress(3, totalSteps, 'Initializing PostgreSQL...'));
    }
    await initializePostgres();

    // Step 4: Initialize Redis
    if (showProgress) {
      console.log(showInitializationProgress(4, totalSteps, 'Initializing Redis...'));
    }
    await initializeRedis();

    // Step 5: Initialize MinIO
    if (showProgress) {
      console.log(showInitializationProgress(5, totalSteps, 'Initializing MinIO...'));
    }
    await initializeMinio();

    // Step 6: Run Prisma migrations
    if (showProgress) {
      console.log(showInitializationProgress(6, totalSteps, 'Running database migrations...'));
    }
    await runPrismaMigrations();

    // Step 7: Final health check
    if (showProgress) {
      console.log(showInitializationProgress(7, totalSteps, 'Performing final health check...'));
    }
    await verifyServices();

    spinner.succeed('Services initialized successfully');
    return true;
  } catch (error) {
    spinner.fail(`Initialization failed: ${error.message}`);
    throw new Error(`Initialization failed: ${error.message}`);
  }
}

async function initializePostgres() {
  try {
    execSync(
      'docker-compose -f docker-compose.dev.yml --profile init up -d postgres-dev postgres-init',
      { stdio: 'pipe' },
    );
    await waitForContainer('zephyr-postgres-init', 'done');
  } catch (error) {
    throw new Error(`PostgreSQL initialization failed: ${error.message}`);
  }
}

async function initializeRedis() {
  try {
    execSync('docker-compose -f docker-compose.dev.yml up -d redis-dev', { stdio: 'pipe' });
    await waitForContainer('zephyr-redis-dev', 'healthy');
  } catch (error) {
    throw new Error(`Redis initialization failed: ${error.message}`);
  }
}

async function initializeMinio() {
  try {
    execSync('docker-compose -f docker-compose.dev.yml --profile init up -d minio-dev minio-init', {
      stdio: 'pipe',
    });
    await waitForContainer('zephyr-minio-init', 'done');
  } catch (error) {
    throw new Error(`MinIO initialization failed: ${error.message}`);
  }
}

async function runPrismaMigrations() {
  try {
    execSync('docker-compose -f docker-compose.dev.yml --profile init up -d prisma-migrate', {
      stdio: 'pipe',
    });
    await waitForContainer('zephyr-prisma-migrate', 'done');
  } catch (error) {
    throw new Error(`Prisma migrations failed: ${error.message}`);
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

async function waitForContainer(container, status) {
  return retry(
    async () => {
      const output = execSync(`docker inspect ${container}`, { stdio: 'pipe' }).toString();
      const info = JSON.parse(output)[0];

      if (status === 'done') {
        if (!info.State.Running && info.State.ExitCode === 0) {
          return true;
        }
      } else if (status === 'healthy') {
        if (info.State.Health && info.State.Health.Status === 'healthy') {
          return true;
        }
      }

      throw new Error(`Container ${container} not ${status}`);
    },
    {
      retries: 30,
      minTimeout: 2000,
      maxTimeout: 5000,
    },
  );
}

export async function verifyServices() {
  const services = await checkServices();
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

async function createNetwork() {
  try {
    execSync('docker network create zephyr_dev_network || true', {
      stdio: 'pipe',
    });
  } catch (error) {
    throw new Error(`Failed to create network: ${error.message}`);
  }
}
