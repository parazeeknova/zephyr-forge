> [!WARNING]
> Deprecated as of 30 May 2025 | This setup is no longer maintained. Please use the manual setup from Zephyr instead. Reason: It does not adhere to suckless principles or minimalism.

<div align="center">

  <a href="https://forge.zephyyrr.in">
    <img src="https://github.com/parazeeknova/zephyr-forge/blob/main/.github/assets/forge-banner-vert.png" alt="Zephyr Logo" width="80%">
  </a>

  <br>
  <br>

  <a href="#about-"><kbd> <br> About <br> </kbd></a>&ensp;&ensp;
  <a href="#getting-started-"><kbd> <br> Getting Started <br> </kbd></a>&ensp;&ensp;
  <a href="https://github.com/parazeeknova/zephyr"><kbd> <br> Zephyr <br> </kbd></a>&ensp;&ensp;
  <a href="https://github.com/parazeeknova/zephyr/issues"><kbd> <br> Troubleshoot <br> </kbd></a>&ensp;&ensp;
  <a href="https://github.com/parazeeknova/zephyr/blob/main/.github/CONTRIBUTING.md"><kbd> <br> Contribution <br> </kbd></a>

</div>

<br>

## About 🚀

Zephyr Forge is a powerful utility designed to streamline the setup process for **_[Zephyr development](https://github.com/parazeeknova/zephyr)_** environments. It automates the entire configuration process, handling everything from dependency checks to Docker container management, allowing contributors to focus on development rather than environment setup.

> [!IMPORTANT]
> [Bun](https://bun.sh) is required to be installed on your system, due to internal dependencies. Running `npx zephyr-forge@latest setup` can cause issues if Bun is not installed. So please make sure to install bun before running the setup command.

## Getting Started 🌱

###### *<div align="center"><sub>Using NPM</sub></div>*

```bash
# Create a new Zephyr project
bunx zephyr-forge@latest init
# or use github packages
bunx @parazeeknova/zephyr-forge@latest init

# Initialize and start your development environment (First time recommended)
bunx zephyr-forge@latest setup

# Start development for an existing project
bunx zephyr-forge@latest dev
```

> [!NOTE]
> Run ```npx zephyr-forge@latest --help``` for more information. If you are using Github Packages, replace `zephyr-forge` with `@parazeeknova/zephyr-forge`.

## Features 🎉

🔁 **Automated Environment Setup and Configuration**: Zephyr Forge takes care of the entire setup process, ensuring that your development environment is configured correctly without manual intervention.

🐋 **Docker Container Management**: Seamlessly manage Docker containers, including creation, starting, stopping, and removal, to ensure a consistent development environment.

📦 **Dependency Installation and Verification**: Automatically install and verify all necessary dependencies, ensuring that your environment has everything it needs to function correctly.

🧹 **Automatic Cleanup and Optimization**: Keep your development environment clean and optimized by automatically removing unnecessary files and optimizing configurations.

🔍 **Environment Health Checks**: Regularly perform health checks on your environment to detect and resolve any issues that may arise, ensuring a stable development experience.

🚀 **One-Command Deployment**: Deploy your development environment with a single command, simplifying the process and reducing the potential for errors.

💻 **Cross-Platform Support (Windows & Unix)**: Enjoy a seamless experience across different operating systems, with full support for both Windows and Unix-based systems.

<div align="center">

  ##### *<div align="left"><sub>// NPMjs Package - <a href="https://www.npmjs.com/package/zephyr-forge">🔗 npmjs.com/zephyr-forge</a></sub></div>*

  ##### *<div align="left"><sub>// Forge Homepage - <a href="https://forge.zephyyrr.in">🔗 link</a></sub></div>*

  <a href="https://forge.zephyyrr.in">
    <img src="https://github.com/parazeeknova/zephyr-forge/blob/main/.github/assets/forge.png" alt="Logo" width="90%">
  </a>

</div>

## Troubleshoot 🛠 

**Having trouble?** [Open an issue](https://github.com/parazeeknova/zephyr-forge/issues/new)

<br>
<br>

<div align="center">
  <a href="https://development.zephyyrr.in">
    <img src="https://raw.githubusercontent.com/parazeeknova/nyxtext-zenith/f4ef877c1ac8c4a5b393a19a086bec2d379b3916/.github/assets/misc/catppuccin_cat.svg" alt="Catppuccino Cat">
  </a>
</div>

##### *<div align="left"><sub>// Copyright © 2025 Parazeeknova</sub></div>*
