import chalk from 'chalk';
import gradient from 'gradient-string';
import boxen from 'boxen';
import figlet from 'figlet';
import ora from 'ora';
import { table } from 'table';
import prettyBytes from 'pretty-bytes';
import prettyMs from 'pretty-ms';

const BOXEN_CONFIG = {
  padding: 1,
  margin: 1,
  borderStyle: 'round',
  borderColor: 'cyan',
};

export const createSpinner = (text) => {
  return ora({
    text,
    color: 'cyan',
    spinner: 'dots',
  });
};

export async function displayBanner(type = 'default') {
  const banners = {
    default: {
      text: 'ZEPHYR',
      font: 'ANSI Shadow',
      gradient: gradient.pastel,
    },
    setup: {
      text: 'SETUP',
      font: 'Slant',
      gradient: gradient.morning,
    },
    dev: {
      text: 'DEV',
      font: 'Speed',
      gradient: gradient.vice,
    },
  };

  const { text, font, gradient: gradientStyle } = banners[type] || banners.default;

  const figletText = figlet.textSync(text, {
    font,
    horizontalLayout: 'fitted',
  });

  const gradientTitle = gradientStyle.multiline(figletText);
  console.clear();
  console.log(
    boxen(gradientTitle, {
      ...BOXEN_CONFIG,
      title: '🚀 Zephyr Forge',
      titleAlignment: 'center',
    }),
  );
}

export function createStatusTable(services) {
  const rows = Object.entries(services).map(([name, info]) => {
    const status = info.status === 'ready' ? chalk.green('✓') : chalk.red('✗');
    return [chalk.blue(name.padEnd(15)), info.url.padEnd(25), status].join(' │ ');
  });

  const header = [
    chalk.bold('Service'.padEnd(15)),
    chalk.bold('URL'.padEnd(25)),
    chalk.bold('Status'),
  ].join(' │ ');

  const separator = '─'.repeat(50);

  return boxen([header, separator, ...rows].join('\n'), {
    ...BOXEN_CONFIG,
    title: '🔍 Services Status',
    titleAlignment: 'center',
  });
}

export function createProgressBar(current, total, width = 40) {
  const percentage = Math.round((current / total) * 100);
  const filled = Math.round((width * current) / total);
  const empty = width - filled;

  const filledBar = chalk.blue('█'.repeat(filled));
  const emptyBar = chalk.gray('░'.repeat(empty));

  return `${filledBar}${emptyBar} ${percentage}%`;
}

export class ProgressSpinner {
  constructor(options = {}) {
    this.spinner = createSpinner(options.text);
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.frameIndex = 0;
    this.interval = null;
  }

  start(text) {
    this.spinner.start(text);
  }

  update(text) {
    this.spinner.text = text;
  }

  succeed(text) {
    this.spinner.succeed(text);
  }

  fail(text) {
    this.spinner.fail(text);
  }

  stop() {
    this.spinner.stop();
  }
}

export function showCompletionMessage(options = {}) {
  const message = [
    chalk.green('🎉 Setup Complete!'),
    '',
    chalk.yellow('Next Steps:'),
    `${chalk.cyan('1.')} cd ${options.directory}`,
    `${chalk.cyan('2.')} pnpm dev`,
    '',
    chalk.yellow('Available Services:'),
    `${chalk.cyan('→')} MinIO Console: http://localhost:9001`,
    `${chalk.cyan('→')} PostgreSQL: localhost:5433`,
    `${chalk.cyan('→')} Redis: localhost:6379`,
  ].join('\n');

  console.log(
    boxen(message, {
      ...BOXEN_CONFIG,
      title: '🚀 Ready to Go!',
      titleAlignment: 'center',
    }),
  );
}

export function createServiceStatusTable(status) {
  if (!status || !status.services) {
    return boxen('No service status available', {
      ...BOXEN_CONFIG,
      title: '🔍 Service Status',
      titleAlignment: 'center',
    });
  }

  const rows = [
    ['Service', 'Status', 'Container', 'Health'].map((h) => chalk.blue(h)).join(' │ '),
    '─'.repeat(70),
  ];

  const statusIcons = {
    running: chalk.green('✓'),
    stopped: chalk.red('✗'),
    missing: chalk.yellow('?'),
    initializing: chalk.blue('⟳'),
    failed: chalk.red('⚠'),
  };

  for (const [serviceName, info] of Object.entries(status.services)) {
    if (!info) continue;

    const row = [
      chalk.white(serviceName.padEnd(15)),
      (info.status || 'unknown').padEnd(15),
      (info.container || 'unknown').padEnd(25),
      statusIcons[info.health] || chalk.gray('-'),
    ].join(' │ ');
    rows.push(row);
  }

  return boxen(rows.join('\n'), {
    ...BOXEN_CONFIG,
    title: '🔍 Service Status',
    titleAlignment: 'center',
  });
}

export function showInitializationProgress(step, total, message) {
  const percentage = Math.round((step / total) * 100);
  const bar = createProgressBar(percentage, 100);
  const output = [chalk.blue('Initialization Progress:'), bar, message].join('\n');

  return boxen(output, {
    ...BOXEN_CONFIG,
    title: '⚙️ Setup',
    titleAlignment: 'center',
  });
}

export function clearLines(count) {
  for (let i = 0; i < count; i++) {
    process.stdout.write('\x1B[K\x1B[1A');
  }
}

export function createContainerStatusTable(containers) {
  const tableConfig = {
    border: {
      topBody: '─',
      topJoin: '┬',
      topLeft: '┌',
      topRight: '┐',
      bottomBody: '─',
      bottomJoin: '┴',
      bottomLeft: '└',
      bottomRight: '┘',
      bodyLeft: '│',
      bodyRight: '│',
      bodyJoin: '│',
      joinBody: '─',
      joinLeft: '├',
      joinRight: '┤',
      joinJoin: '┼',
    },
    columns: {
      0: { alignment: 'left' },
      1: { alignment: 'left' },
      2: { alignment: 'right' },
      3: { alignment: 'right' },
      4: { alignment: 'right' },
    },
    drawHorizontalLine: (index, size) => index === 0 || index === 1 || index === size,
  };

  const data = [['Container', 'Status', 'Memory', 'CPU', 'Uptime'].map((h) => chalk.blue(h))];

  for (const container of containers) {
    const stats = getContainerStats(container.Id);
    data.push([
      container.Names[0].replace(/^\//, ''),
      `${getStatusEmoji(container.State)} ${container.State}`,
      prettyBytes(stats.memory_stats.usage),
      `${stats.cpu_stats.cpu_usage.percent.toFixed(2)}%`,
      prettyMs(Date.now() - new Date(container.Created).getTime()),
    ]);
  }

  return boxen(table(data, tableConfig), {
    ...BOXEN_CONFIG,
    title: '🔍 Container Status',
    titleAlignment: 'center',
  });
}

function getStatusEmoji(status) {
  const statusMap = {
    running: '🟢',
    created: '🟡',
    restarting: '🔄',
    removing: '🗑️',
    paused: '⏸️',
    exited: '🔴',
    dead: '💀',
  };
  return statusMap[status.toLowerCase()] || '❓';
}

export async function getContainerStats(containerId) {
  try {
    const { execSync } = await import('node:child_process');
    const stats = JSON.parse(
      execSync(`docker stats ${containerId} --no-stream --format "{{json .}}"`, {
        stdio: ['pipe', 'pipe', 'pipe'],
      }).toString(),
    );

    return {
      memory_stats: {
        usage: Number.parseInt(stats.MemUsage.split('/')[0].trim()),
      },
      cpu_stats: {
        cpu_usage: {
          percent: Number.parseFloat(stats.CPUPerc.replace('%', '')),
        },
      },
    };
  } catch (error) {
    return {
      memory_stats: { usage: 0 },
      cpu_stats: { cpu_usage: { percent: 0 } },
    };
  }
}
