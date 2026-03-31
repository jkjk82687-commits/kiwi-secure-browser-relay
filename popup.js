// Kiwi Secure Relay - Popup Script

const attachBtn = document.getElementById('attachBtn');
const detachBtn = document.getElementById('detachBtn');
const statusDiv = document.getElementById('status');

// Update UI based on status
function updateUI(status) {
  if (status.attached) {
    attachBtn.style.display = 'none';
    detachBtn.style.display = 'inline-block';
    statusDiv.textContent = '✓ Attached to tab';
    statusDiv.className = 'status-attached';
  } else {
    attachBtn.style.display = 'inline-block';
    detachBtn.style.display = 'none';
    statusDiv.textContent = status.connected ? 'Connected to relay' : 'Disconnected';
    statusDiv.className = '';
  }
}

// Check current status
function checkStatus() {
  chrome.runtime.sendMessage({ action: 'status' }, (response) => {
    if (chrome.runtime.lastError) {
      statusDiv.textContent = '⚠ Extension error';
      statusDiv.className = 'status-error';
      return;
    }
    updateUI(response || { attached: false, connected: false });
  });
}

// Attach button handler
attachBtn.addEventListener('click', () => {
  attachBtn.disabled = true;
  statusDiv.textContent = 'Connecting...';
  
  chrome.runtime.sendMessage({ action: 'attach' }, (response) => {
    attachBtn.disabled = false;
    
    if (chrome.runtime.lastError) {
      statusDiv.textContent = '⚠ ' + chrome.runtime.lastError.message;
      statusDiv.className = 'status-error';
      return;
    }
    
    if (response?.success) {
      statusDiv.textContent = '✓ Attached to tab';
      statusDiv.className = 'status-attached';
      attachBtn.style.display = 'none';
      detachBtn.style.display = 'inline-block';
    } else {
      statusDiv.textContent = '⚠ ' + (response?.error || 'Unknown error');
      statusDiv.className = 'status-error';
    }
  });
});

// Detach button handler
detachBtn.addEventListener('click', () => {
  detachBtn.disabled = true;
  
  chrome.runtime.sendMessage({ action: 'detach' }, (response) => {
    detachBtn.disabled = false;
    
    if (response?.success) {
      statusDiv.textContent = 'Disconnected';
      statusDiv.className = '';
      attachBtn.style.display = 'inline-block';
      detachBtn.style.display = 'none';
    }
  });
});

// Initial status check
checkStatus();
