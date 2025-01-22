import chalk from 'chalk';
import inquirer from 'inquirer';
import { execSync } from 'node:child_process';
import fs from 'fs-extra';
import path from 'node:path';
import boxen from 'boxen';
import gradient from 'gradient-string';
import figlet from 'figlet';
import { createSpinner } from 'nanospinner';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);

const sleep = (ms = 1000) => new Promise((resolve) => setTimeout(resolve, ms));

async function displayBanner() {
    console.clear();
    const title = figlet.textSync('ZEPHYR', {
        font: 'ANSI Shadow',
        horizontalLayout: 'fitted',
    });
    
    console.log(gradient.pastel.multiline(title));
    console.log('\n');
    console.log(chalk.white.bold('Social Media Aggregator'));
    console.log(chalk.gray('Version 1.0.0 by parazeeknova\n'));
    await sleep(1000);
}

async function detectPackageManager() {
    const packageManagers = [
        {
            name: 'pnpm',
            command: 'pnpm -v',
            installCmd: 'npm install -g pnpm',
            speed: 'Fastest',
            diskUsage: 'Lowest'
        },
        {
            name: 'bun',
            command: 'bun -v',
            installCmd: 'npm install -g bun',
            speed: 'Very Fast',
            diskUsage: 'Low'
        },
        {
            name: 'yarn',
            command: 'yarn -v',
            installCmd: 'npm install -g yarn',
            speed: 'Fast',
            diskUsage: 'Medium'
        },
        {
            name: 'npm',
            command: 'npm -v',
            installCmd: null,
            speed: 'Standard',
            diskUsage: 'High'
        }
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
    const spinner = createSpinner('Detecting package managers...').start();
    await sleep(1000);
    
    const { installed, notInstalled } = await detectPackageManager();
    spinner.success({ text: 'Package managers detected!' });
    await sleep(500);

    console.log('\n');
    const choices = installed.map(pm => ({
        name: `${pm.name} v${pm.version} (${chalk.green('✓ installed')}) - ${chalk.blue(pm.speed)} | ${chalk.yellow(pm.diskUsage)} disk usage`,
        value: pm.name
    }));

    if (notInstalled.length > 0) {
        choices.push(new inquirer.Separator('─── Not Installed ───'));
        choices.push(...notInstalled.map(pm => ({
            name: `${pm.name} (${chalk.red('✗ not installed')}) - ${chalk.blue(pm.speed)} | ${chalk.yellow(pm.diskUsage)} disk usage`,
            value: pm.name,
            disabled: true
        })));
    }

    const { packageManager } = await inquirer.prompt([
        {
            type: 'list',
            name: 'packageManager',
            message: 'Select your preferred package manager:',
            choices,
            default: installed[0]?.name || 'npm'
        }
    ]);

    return packageManager;
}

async function checkDependencies() {
    console.clear();
    console.log(boxen(chalk.cyan('\n🔍 Checking Dependencies\n'), { padding: 1 }));
    
    const dependencies = {
        'Git': 'git --version',
        'Docker': 'docker --version',
        'Node.js': 'node --version'
    };

    for (const [dep, command] of Object.entries(dependencies)) {
        const spinner = createSpinner(`Checking ${dep}...`).start();
        await sleep(500);
        
        try {
            const version = execSync(command, { stdio: 'pipe' }).toString().trim();
            spinner.success({ text: `${dep} ${chalk.green(version)}` });
        } catch (error) {
            spinner.error({ text: `${dep} ${chalk.red('not found')}` });
            console.log(chalk.yellow(`\n⚠️  Please install ${dep} to continue`));
            process.exit(1);
        }
    }
    
    await sleep(1000);
}

async function getInstallLocation() {
    console.clear();
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const currentDir = process.cwd();

    console.log(boxen(chalk.cyan('\n📂 Installation Location\n'), { padding: 1 }));

    const { location } = await inquirer.prompt([
        {
            type: 'list',
            name: 'location',
            message: 'Where would you like to install Zephyr?',
            choices: [
                {
                    name: `Current Directory ${chalk.gray(`(${currentDir}/zephyr)`)}`,
                    value: path.join(currentDir, 'zephyr')
                },
                {
                    name: `Downloads ${chalk.gray(`(${path.join(homeDir, 'Downloads/zephyr')})`)}`,
                    value: path.join(homeDir, 'Downloads', 'zephyr')
                },
                {
                    name: `Desktop ${chalk.gray(`(${path.join(homeDir, 'Desktop/zephyr')})`)}`,
                    value: path.join(homeDir, 'Desktop', 'zephyr')
                },
                new inquirer.Separator(),
                {
                    name: chalk.blue('⚡ Custom Location'),
                    value: 'custom'
                }
            ]
        }
    ]);

    if (location === 'custom') {
        const { customPath } = await inquirer.prompt([
            {
                type: 'input',
                name: 'customPath',
                message: 'Enter custom installation path:',
                validate: input => input.length > 0 || 'Please enter a valid path'
            }
        ]);
        return path.resolve(customPath);
    }

    return location;
}

async function selectBranch() {
    console.clear();
    console.log(boxen(chalk.cyan('\n🌿 Select Branch\n'), { padding: 1 }));

    const { branch } = await inquirer.prompt([
        {
            type: 'list',
            name: 'branch',
            message: 'Select installation branch:',
            choices: [
                {
                    name: `${chalk.green('main')} - ${chalk.gray('Stable release branch')}`,
                    value: 'main'
                },
                {
                    name: `${chalk.yellow('development')} - ${chalk.gray('Development branch (recommended)')}`,
                    value: 'development'
                }
            ]
        }
    ]);
    return branch;
}

async function installZephyr(installDir, packageManager) {
    console.clear();
    console.log(boxen(chalk.cyan('\n⚡ Installing Zephyr\n'), { padding: 1 }));
    console.log(chalk.gray(`Installation Directory: ${installDir}`));
    console.log(chalk.gray(`Package Manager: ${packageManager}\n`));

    if (fs.existsSync(installDir)) {
        const spinner = createSpinner('Cleaning existing directory...').start();
        await fs.remove(installDir);
        await sleep(500);
        spinner.success({ text: 'Cleaned existing directory' });
    }

    try {
        const branch = await selectBranch();
        
        const cloneSpinner = createSpinner('Cloning Zephyr repository...').start();
        execSync(`git clone -b ${branch} https://github.com/parazeeknova/zephyr.git "${installDir}"`, { stdio: 'ignore' });
        await sleep(1000);
        cloneSpinner.success({ text: 'Repository cloned successfully' });

        process.chdir(installDir);

        console.log('\n📦 Installing project dependencies...\n');
        console.log(chalk.yellow('This might take a few minutes. Please wait...\n'));
        
        try {
            const outputLog = fs.createWriteStream('installation-output.log');
            const errorLog = fs.createWriteStream('installation-error.log');
            
            const installProcess = execSync(`${packageManager} install`, { 
                stdio: ['ignore', 'pipe', 'pipe'],
                encoding: 'utf-8'
            });
            
            console.log(chalk.blue('📋 Installation Logs:'));
            console.log(chalk.gray('─'.repeat(50)));
            console.log(installProcess);
            console.log(chalk.gray('─'.repeat(50)));
            
            outputLog.end();
            errorLog.end();
            
        } catch (error) {
            console.error(chalk.red('\n❌ Dependency installation failed:'));
            console.error(chalk.gray(error.message));
            throw error;
        }

        console.clear();
        console.log(boxen(chalk.green('\n🚀 Starting Zephyr\n'), { padding: 1 }));
        console.log(chalk.yellow('Initializing the development environment...\n'));

        try {
            console.log(chalk.blue('📋 Startup Logs:'));
            console.log(chalk.gray('─'.repeat(50)));
            
            const startProcess = execSync(`${packageManager} run start`, {
                stdio: 'inherit',
                encoding: 'utf-8'
            });

        } catch (error) {
            console.error(chalk.red('\n❌ Project startup failed:'));
            console.error(chalk.gray(error.message));
            throw error;
        }

        await showCompletionMenu(installDir, packageManager);

    } catch (error) {
        console.clear();
        console.error(boxen(chalk.red('\n❌ Installation Failed!\n'), { padding: 1 }));
        console.error(chalk.yellow('Error Details:'));
        console.error(chalk.gray(error.message));
        
        if (fs.existsSync('installation-output.log')) {
            console.log(chalk.yellow('\nInstallation Logs:'));
            console.log(chalk.gray(fs.readFileSync('installation-output.log', 'utf-8')));
        }
        if (fs.existsSync('installation-error.log')) {
            console.log(chalk.red('\nError Logs:'));
            console.log(chalk.gray(fs.readFileSync('installation-error.log', 'utf-8')));
        }
        
        process.exit(1);
    } finally {
        fs.removeSync('installation-output.log');
        fs.removeSync('installation-error.log');
    }
}

async function showCompletionMenu(installDir, packageManager) {
    console.clear();
    console.log(boxen(
        chalk.green('\n✨ Installation Complete!\n') +
        chalk.white('\nZephyr has been successfully installed.\n'),
        { padding: 1 }
    ));

    const { action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'What would you like to do next?',
            choices: [
                {
                    name: `${chalk.blue('📝 Open in Visual Studio Code')}`,
                    value: 'code'
                },
                {
                    name: `${chalk.yellow('📂 Open Folder Location')}`,
                    value: 'folder'
                },
                {
                    name: `${chalk.green('🚀 Start Development Server')}`,
                    value: 'dev'
                },
                new inquirer.Separator(),
                {
                    name: `${chalk.gray('👋 Exit')}`,
                    value: 'exit'
                }
            ]
        }
    ]);

    console.clear();
    const spinner = createSpinner('Processing...').start();
    await sleep(500);

    try {
        switch (action) {
            case 'code':
                if (commandExists('code')) {
                    execSync(`code "${installDir}"`, { stdio: 'inherit' });
                    spinner.success({ text: 'Opening VS Code...' });
                } else {
                    spinner.error({ text: 'VS Code is not installed' });
                }
                break;
            case 'folder': {
                const command = process.platform === 'win32' ? 'explorer' : 
                              process.platform === 'darwin' ? 'open' : 'xdg-open';
                execSync(`${command} "${installDir}"`, { stdio: 'inherit' });
                spinner.success({ text: 'Opening folder...' });
                break;
            }
            case 'dev':
                spinner.success({ text: 'Starting development server...' });
                console.log('\n');
                execSync(`${packageManager} run dev`, { stdio: 'inherit' });
                break;
            case 'exit':
                spinner.success({ text: 'Thank you for installing Zephyr! 👋' });
                break;
        }
    } catch (error) {
        spinner.error({ text: `Failed to execute action: ${error.message}` });
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
        console.log(chalk.red('Usage: npx zephyrforge init'));
        process.exit(1);
    }

    await displayBanner();
    await checkDependencies();
    const packageManager = await selectPackageManager();
    const installLocation = await getInstallLocation();
    await installZephyr(installLocation, packageManager);
}

main().catch(console.error);
