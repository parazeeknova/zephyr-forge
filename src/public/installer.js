const CONFIG = window.SERVER_CONFIG || {
    API_BASE: '/api',
    STATUS_INTERVAL: 30000,
    COPY_TIMEOUT: 1000,
    TOAST_DURATION: 2000
  };
  
  const funnyMessages = [
    "Command copied successfully!",
    "Ready to install Zephyr!",
    "Clipboard updated with magic ✨",
    "Command locked and loaded",
    "Copy complete, ready for action",
    "Installation command acquired",
    "Ready when you are, captain",
    "Command copied, let's roll!"
  ];
  
  const API = {
    status: `${CONFIG.API_BASE}/status`,
    copyCount: (type) => `${CONFIG.API_BASE}/copy-count/${type}`,
  };
  
  function showToast(message, isError = false, duration = CONFIG.TOAST_DURATION) {
    const toast = document.getElementById('toast');
    if (!toast) return;
  
    toast.textContent = message;
    toast.className = `toast ${isError ? 'error' : ''} show`;
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }
  
  async function checkStatus() {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    
    if (!statusDot || !statusText) return;
    
    try {
      const response = await fetch(API.status);
      if (!response.ok) throw new Error('API response not ok');
      
      const data = await response.json();
      
      if (data.status === 'operational') {
        statusDot.className = 'status-dot operational';
        statusText.textContent = 'System Operational';
      } else {
        throw new Error('System not operational');
      }
    } catch (error) {
      console.error('Status check failed:', error);
      statusDot.className = 'status-dot error';
      statusText.textContent = 'System Error';
      
      // Retry sooner on error
      setTimeout(checkStatus, CONFIG.STATUS_INTERVAL / 2);
    }
  }
  
  async function updateCopyCount(type) {
    if (!type) return;
    
    try {
      const response = await fetch(API.copyCount(type), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Failed to update count');
      
      const data = await response.json();
      const countElement = document.querySelector(`[data-command="${type}"] .copy-count`);
      
      if (countElement) {
        countElement.textContent = `(${data.count})`;
      }
    } catch (error) {
      console.error('Failed to update copy count:', error);
      showToast('Failed to update counter', true);
    }
  }
  
  async function initializeCopyCount() {
    const types = ['unix', 'windows', 'npm'];
    
    for (const type of types) {
      try {
        const response = await fetch(API.copyCount(type));
        if (!response.ok) throw new Error(`Failed to get ${type} count`);
        
        const data = await response.json();
        const countElement = document.querySelector(`[data-command="${type}"] .copy-count`);
        
        if (countElement) {
          countElement.textContent = `(${data.count})`;
        }
      } catch (error) {
        console.error(`Failed to initialize ${type} count:`, error);
      }
    }
  }
  
  async function copyCommand(wrapper) {
    if (!wrapper) return;
    
    const command = wrapper.querySelector('.command');
    const button = wrapper.querySelector('.copy-button');
    const type = wrapper.dataset.command;
    
    if (!command || !button || !type) return;
    
    try {
      await navigator.clipboard.writeText(command.textContent);
      wrapper.classList.add('copied');
      button.textContent = 'copied!';
      
      await updateCopyCount(type);
      
      const randomMessage = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
      showToast(randomMessage);
    } catch (err) {
      console.error('Copy failed:', err);
      showToast('Failed to copy command', true);
    } finally {
      setTimeout(() => {
        wrapper.classList.remove('copied');
        button.textContent = 'copy';
      }, CONFIG.COPY_TIMEOUT);
    }
  }

  function initializeUI() {
    // biome-ignore lint/complexity/noForEach: This is a simple loop
    document.querySelectorAll('.command-wrapper').forEach(wrapper => {
      const button = wrapper.querySelector('.copy-button');
      if (!button) return;
      
      const countSpan = document.createElement('span');
      countSpan.className = 'copy-count';
      countSpan.textContent = '(0)';
      button.parentNode.insertBefore(countSpan, button.nextSibling);
      
      wrapper.addEventListener('click', (e) => {
        if (!e.target.classList.contains('copy-button')) {
          copyCommand(wrapper);
        }
      });
  
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        copyCommand(wrapper);
      });
    });
  }
  
  const style = document.createElement('style');
  style.textContent = `
    .copy-count {
      font-size: 0.75rem;
      color: var(--dim);
      opacity: 0.8;
      margin-left: 0.5rem;
    }
  
    .command-wrapper {
      display: flex;
      align-items: center;
    }
  
    .command {
      flex: 1;
    }
  
    .toast.error {
      background: rgba(244, 67, 54, 0.9);
    }
  
    @media (max-width: 480px) {
      .copy-count {
        font-size: 0.7rem;
        margin-left: 0.3rem;
      }
    }
  `;

  function init() {
    document.head.appendChild(style);
    initializeUI();
    checkStatus();
    initializeCopyCount();
    setInterval(checkStatus, CONFIG.STATUS_INTERVAL);
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
