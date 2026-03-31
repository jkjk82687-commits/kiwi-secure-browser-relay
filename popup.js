// Kiwi Secure Relay - Popup Script

const btnAttach = document.getElementById('btn-attach');
const btnDetach = document.getElementById('btn-detach');
const connectionStatus = document.getElementById('connection-status');
const tabStatus = document.getElementById('tab-status');
const messageDiv = document.getElementById('message');

function showMessage(text, type) {
  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;
}

function hideMessage() {
  messageDiv.className = 'message hidden';
}

async function updateStatus() {
  const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
  
  // Update connection status
  if (response.connected) {
    connectionStatus.textContent = 'Connected';
    connectionStatus.className = 'status-value connected';
  } else {
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.className = 'status-value disconnected';
  }
  
  // Update tab status
  if (response.tabAttached) {
    tabStatus.textContent = 'Attached';
    tabStatus.className = 'status-value connected';
    btnAttach.classList.add('hidden');
    btnDetach.classList.remove('hidden');
  } else {
    tabStatus.textContent = 'Not Attached';
    tabStatus.className = 'status-value disconnected';
    btnAttach.classList.remove('hidden');
    btnDetach.classList.add('hidden');
  }
}

btnAttach.addEventListener('click', async () => {
  btnAttach.disabled = true;
  hideMessage();
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'attach' });
    
    if (response.success) {
      showMessage('✓ Tab attached successfully!', 'success');
      updateStatus();
    } else if (response.error) {
      showMessage(`✗ ${response.error}`, 'error');
    }
  } catch (e) {
    showMessage(`✗ ${e.message}`, 'error');
  } finally {
    btnAttach.disabled = false;
  }
});

btnDetach.addEventListener('click', async () => {
  btnDetach.disabled = true;
  hideMessage();
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'detach' });
    
    if (response.success) {
      showMessage('✓ Tab detached', 'success');
      updateStatus();
    } else if (response.error) {
      showMessage(`✗ ${response.error}`, 'error');
    }
  } catch (e) {
    showMessage(`✗ ${e.message}`, 'error');
  } finally {
    btnDetach.disabled = false;
  }
});

// Initial status check
updateStatus();
