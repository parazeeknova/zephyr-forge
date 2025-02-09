import './styles/main.scss';

const zephyrLogo = `
███████╗███████╗██████╗ ██╗  ██╗██╗   ██╗██████╗ 
╚══███╔╝██╔════╝██╔══██╗██║  ██║╚██╗ ██╔╝██╔══██╗
  ███╔╝ █████╗  ██████╔╝███████║ ╚████╔╝ ██████╔╝
 ███╔╝  ██╔══╝  ██╔═══╝ ██╔══██║  ╚██╔╝  ██╔══██╗
███████╗███████╗██║     ██║  ██║   ██║   ██║  ██║
╚══════╝╚══════╝╚═╝     ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝`;

const forgeLogo = `
███████╗ ██████╗ ██████╗  ██████╗ ███████╗
██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██╔════╝
█████╗  ██║   ██║██████╔╝██║  ███╗█████╗  
██╔══╝  ██║   ██║██╔══██╗██║   ██║██╔══╝  
██║     ╚██████╔╝██║  ██║╚██████╔╝███████╗
╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝`;

const API_BASE = process.env.NODE_ENV === 'production' ? 'https://forge.zephyyrr.in' : '';

document.addEventListener('DOMContentLoaded', () => {
  injectLogos();
  setupStatusCheck();
  setupCopyHandlers();
});

function setupStatusCheck() {
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.querySelector('.status-text');

  const updateStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/status`);
      const data = await response.json();

      if (data.status === 'operational') {
        statusDot.classList.add('operational');
        statusDot.classList.remove('error');
        statusText.textContent = 'System Operational';
      } else {
        statusDot.classList.add('error');
        statusDot.classList.remove('operational');
        statusText.textContent = 'System Error';
      }

      const systemInfo = `
        Memory: ${Math.round(data.system.memory.percentage)}% used
        CPU Cores: ${data.system.cpu.cores}
        Uptime: ${Math.round(data.uptime / 3600)}h ${Math.round((data.uptime % 3600) / 60)}m
      `;
      statusText.title = systemInfo;
    } catch (error) {
      console.error('Failed to fetch status:', error);
      statusDot.classList.add('error');
      statusDot.classList.remove('operational');
      statusText.textContent = 'Status Check Failed';
    }
  };

  updateStatus();
  setInterval(updateStatus, 30000);
}

function setupCopyHandlers() {
  const commandWrappers = document.querySelectorAll('.command-wrapper');
  const toast = document.getElementById('toast');

  const showToast = (message, type = 'success') => {
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  };

  const updateCopyCount = async (type) => {
    try {
      const response = await fetch(`${API_BASE}/api/copy-count/${type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();

      if (data.count !== undefined) {
        const wrapper = document.querySelector(`[data-command="${type}"]`);
        const copyButton = wrapper.querySelector('.copy-button');
        copyButton.setAttribute('data-count', `${data.count} copies`);

        copyButton.classList.add('count-updated');
        setTimeout(() => {
          copyButton.classList.remove('count-updated');
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to update copy count:', error);
    }
  };

  const copyCommand = async (wrapper) => {
    const commandType = wrapper.dataset.command;
    const commandText = wrapper.querySelector('.command').textContent;
    const copyButton = wrapper.querySelector('.copy-button');

    try {
      await navigator.clipboard.writeText(commandText.trim());
      showToast(`${commandType.toUpperCase()} command copied! 📋`);
      copyButton.classList.add('copied');

      await updateCopyCount(commandType);

      setTimeout(() => {
        copyButton.classList.remove('copied');
      }, 1000);
    } catch (error) {
      showToast('Failed to copy command ❌', 'error');
      console.error('Copy failed:', error);
    }
  };

  const initializeCopyCounts = async () => {
    const types = ['npm', 'unix', 'windows'];
    for (const type of types) {
      try {
        const response = await fetch(`${API_BASE}/api/copy-count/${type}`);
        const data = await response.json();

        if (data.count !== undefined) {
          const wrapper = document.querySelector(`[data-command="${type}"]`);
          const copyButton = wrapper.querySelector('.copy-button');
          copyButton.setAttribute('data-count', `${data.count} copies`);
        }
      } catch (error) {
        console.error(`Failed to fetch copy count for ${type}:`, error);
      }
    }
  };

  commandWrappers.forEach((wrapper) => {
    const command = wrapper.querySelector('.command');
    const copyButton = wrapper.querySelector('.copy-button');

    wrapper.addEventListener('mouseenter', () => {
      copyButton.classList.add('visible');
    });

    wrapper.addEventListener('mouseleave', () => {
      copyButton.classList.remove('visible');
    });

    command.addEventListener('click', () => copyCommand(wrapper));
    copyButton.addEventListener('click', () => copyCommand(wrapper));
  });

  initializeCopyCounts();
}

function injectLogos() {
  const logoContainer = document.createElement('a');
  logoContainer.href = 'https://development.zephyyrr.in';
  logoContainer.className = 'logo-container';
  logoContainer.target = '_blank';
  logoContainer.rel = 'noopener noreferrer';

  const mainLogo = document.createElement('div');
  mainLogo.className = 'logo';
  mainLogo.textContent = zephyrLogo;

  const hoverLogo = document.createElement('div');
  hoverLogo.className = 'logo-hover';
  hoverLogo.textContent = forgeLogo;

  logoContainer.appendChild(mainLogo);
  logoContainer.appendChild(hoverLogo);

  const terminal = document.querySelector('.terminal');
  terminal.insertBefore(logoContainer, terminal.firstChild);
}

const style = document.createElement('style');
style.textContent = `
  .copy-button {
    position: relative;
    transition: all 0.3s ease;
    opacity: 0;
    transform: translateX(10px);
  }

  .copy-button.visible {
    opacity: 1;
    transform: translateX(0);
  }

  .copy-button.copied {
    background-color: #50fa7b;
    color: #282a36;
    transform: scale(1.1);
  }

  .copy-button[data-count]::after {
    content: attr(data-count);
    position: absolute;
    bottom: -20px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 12px;
    color: #6272a4;
    white-space: nowrap;
    transition: all 0.3s ease;
  }

  .copy-button.count-updated[data-count]::after {
    color: #50fa7b;
    transform: translateX(-50%) scale(1.1);
  }

  .toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 24px;
    background-color: #50fa7b;
    color: #282a36;
    border-radius: 4px;
    opacity: 0;
    transform: translateY(100%);
    transition: all 0.3s ease;
    z-index: 1000;
  }

  .toast.show {
    opacity: 1;
    transform: translateY(0);
  }

  .toast.error {
    background-color: #ff5555;
    color: #f8f8f2;
  }

  .command-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    border-radius: 4px;
    transition: all 0.3s ease;
  }

  .command-wrapper:hover {
    background-color: rgba(98, 114, 164, 0.1);
  }

  .command {
    cursor: pointer;
    user-select: all;
  }
`;

document.head.appendChild(style);
