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

document.addEventListener('DOMContentLoaded', () => {
  injectLogos();

  const statusDot = document.querySelector('.status-dot');
  const statusText = document.querySelector('.status-text');

  const updateStatus = async () => {
    try {
      const response = await fetch('/api/status');
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

  const command = document.querySelector('.command');
  const copyButton = document.querySelector('.copy-button');
  const toast = document.querySelector('#toast');

  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(command.textContent);
      showToast('Command copied to clipboard!');

      const API_BASE = process.env.NODE_ENV === 'production' ? 'https://forge.zephyyrr.in' : '';

      const response = await fetch(`${API_BASE}/api/status`);
      const data = await response.json();

      if (data.count) {
        copyButton.setAttribute('data-count', `${data.count} copies`);
      }
    } catch (err) {
      showToast('Failed to copy command');
      console.error('Copy failed:', err);
    }
  };

  command.addEventListener('click', copyText);
  copyButton.addEventListener('click', copyText);

  updateStatus();

  setInterval(updateStatus, 30000);

  fetch('/api/copy-count')
    .then((response) => response.json())
    .then((data) => {
      if (data.count) {
        copyButton.setAttribute('data-count', `${data.count} copies`);
      }
    })
    .catch(console.error);
});

function injectLogos() {
  const logoContainer = document.createElement('a');
  logoContainer.href = 'https://development.zephyyrr.in';
  logoContainer.className = 'logo-container';
  logoContainer.target = '_blank';

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
