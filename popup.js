// Kiwi Secure Relay - Popup Script (v1.4.1)

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
  try {
    chrome.runtime.sendMessage({ action: 'status' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Status check error:', chrome.runtime.lastError);
        statusDiv.textContent = '⚠ Background not ready';
        statusDiv.className = 'status-error';
        return;
      }
      updateUI(response || { attached: false, connected: false });
    });
  } catch (err) {
    statusDiv.textContent = '⚠ ' + err.message;
    statusDiv.className = 'status-error';
  }
}

// Attach button handler
attachBtn.addEventListener('click', () => {
  attachBtn.disabled = true;
  statusDiv.textContent = '⏳ Connecting...';
  statusDiv.className = '';
  
  try {
    chrome.runtime.sendMessage({ action: 'attach' }, (response) => {
      attachBtn.disabled = false;
      
      if (chrome.runtime.lastError) {
        console.error('Attach error:', chrome.runtime.lastError);
        statusDiv.textContent = '⚠ ' + chrome.runtime.lastError.message;
        statusDiv.className = 'status-error';
        return;
      }
      
      console.log('Attach response:', response);
      
      if (response && response.success) {
        statusDiv.textContent = '✓ Attached to tab';
        statusDiv.className = 'status-attached';
        attachBtn.style.display = 'none';
        detachBtn.style.display = 'inline-block';
      } else {
        const errorMsg = response?.error || 'Unknown error';
        statusDiv.textContent = '⚠ ' + errorMsg;
        statusDiv.className = 'status-error';
        console.error('Attach failed:', errorMsg);
      }
    });
  } catch (err) {
    attachBtn.disabled = false;
    statusDiv.textContent = '⚠ ' + err.message;
    statusDiv.className = 'status-error';
  }
});

// Detach button handler
detachBtn.addEventListener('click', () => {
  detachBtn.disabled = true;
  
  try {
    chrome.runtime.sendMessage({ action: 'detach' }, (response) => {
      detachBtn.disabled = false;
      
      if (chrome.runtime.lastError) {
        console.error('Detach error:', chrome.runtime.lastError);
      }
      
      statusDiv.textContent = 'Disconnected';
      statusDiv.className = '';
      attachBtn.style.display = 'inline-block';
      detachBtn.style.display = 'none';
    });
  } catch (err) {
    detachBtn.disabled = false;
    statusDiv.textContent = '⚠ ' + err.message;
    statusDiv.className = 'status-error';
  }
});

// Initial status check
checkStatus();
