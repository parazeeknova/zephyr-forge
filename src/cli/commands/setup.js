import { intro, outro, spinner, confirm } from '@clack/prompts';
import chalk from 'chalk';
import { displayBanner } from '../../lib/ui.js';
import { checkDocker } from '../../lib/docker.js';
import { createEnvFiles } from '../../lib/env.js';
import { validateProjectStructure } from '../../lib/utils.js';
import { showCompletionMessage } from '../../lib/ui.js';

export async function setupCommand(options) {
  await displayBanner('setup');
  intro(chalk.blue('🚀 Setting up Zephyr Development Environment'));

  const s = spinner();
  try {
    s.start('Validating project structure');
    const structureValidation = await validateProjectStructure(options.projectRoot);
    if (!structureValidation.valid) {
      throw new Error(`Invalid project structure: ${structureValidation.missingFiles.join(', ')}`);
    }
    s.stop('Project structure valid');

    s.start('Checking Docker environment');
    await checkDocker();
    s.stop('Docker environment ready');

    s.start('Setting up environment files');
    try {
      await createEnvFiles(options.projectRoot);
      s.stop('Environment files created');
    } catch (error) {
      s.stop(chalk.red(`Failed to create environment files: ${error.message}`));
      throw error;
    }

    if (!options.skipCompletion) {
      showCompletionMessage({ directory: options.projectRoot });
      outro(chalk.green('✨ Setup complete! Run `zephyr-forge dev` to start development'));
    }
  } catch (error) {
    s.stop(chalk.red(`Error: ${error.message}`));

    const shouldRetry = await confirm({
      message: 'Would you like to retry setup?',
      initialValue: true,
    });

    if (shouldRetry) {
      return setupCommand(options);
    }

    outro(chalk.red('Setup failed. Please check the error and try again.'));
    process.exit(1);
  }
}
