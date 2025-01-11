// Existing copy functionality
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
  
  function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }
  
  // Add the status check functionality
  async function checkStatus() {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      
      if (data.status === 'operational') {
        statusDot.className = 'status-dot operational';
        statusText.textContent = 'System Operational';
      } else {
        throw new Error('System not operational');
      }
    } catch (error) {
      statusDot.className = 'status-dot error';
      statusText.textContent = 'System Error';
    }
  }
  
  // Command copy functionality
  document.querySelectorAll('.command-wrapper').forEach(wrapper => {
    const command = wrapper.querySelector('.command');
    const button = wrapper.querySelector('.copy-button');
    
    async function copyCommand() {
      try {
        await navigator.clipboard.writeText(command.textContent);
        wrapper.classList.add('copied');
        button.textContent = 'copied!';
        
        const randomMessage = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
        showToast(randomMessage);
  
        setTimeout(() => {
          wrapper.classList.remove('copied');
          button.textContent = 'copy';
        }, 1000);
      } catch (err) {
        showToast('Failed to copy command');
        console.error('Copy failed:', err);
      }
    }
  
    // Make both the wrapper and button clickable
    wrapper.addEventListener('click', (e) => {
      if (!e.target.classList.contains('copy-button')) {
        copyCommand();
      }
    });
  
    button.addEventListener('click', (e) => {
      e.stopPropagation();  // Prevent double copying
      copyCommand();
    });
  });
  
  // Initialize status check
  checkStatus();
  setInterval(checkStatus, 30000);