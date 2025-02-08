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

window.addEventListener('DOMContentLoaded', () => {
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

  const command = document.querySelector('.command');
  const copyButton = document.querySelector('.copy-button');
  const toast = document.querySelector('#toast');

  if (!command || !copyButton || !toast) {
    console.error('Required elements not found');
    return;
  }

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

      await fetch('/api/copy-count', {
        method: 'POST',
      });
    } catch (err) {
      showToast('Failed to copy command');
      console.error('Copy failed:', err);
    }
  };

  copyButton.addEventListener('click', copyText);
  command.addEventListener('click', copyText);
});
