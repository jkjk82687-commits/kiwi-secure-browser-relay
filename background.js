// Kiwi Secure Browser Relay - Hardened by Shenzhen Kiwi Technology
// Version 1.4.0 - Fixed popup button handler

const VPS_WS = 'ws://93.127.213.22:18792';
const ALLOWED_HOST = '93.127.213.22';

let relayWs = null;
let attachedTabId = null;

// Badge management
function setBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

// Connect to VPS relay
function connectToRelay() {
  if (relayWs && relayWs.readyState === WebSocket.OPEN) {
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    try {
      relayWs = new WebSocket(VPS_WS);
      
      relayWs.onopen = () => {
        console.log('Connected to Kiwi VPS relay');
        setBadge('ON', '#00a651');
        resolve();
      };
      
      relayWs.onmessage = (event) => {
        console.log('Received from relay:', event.data);
        // Handle incoming CDP commands from relay
        if (attachedTabId) {
          handleRelayMessage(JSON.parse(event.data));
        }
      };
      
      relayWs.onerror = (err) => {
        console.error('WebSocket error:', err);
        setBadge('!', '#ef4444');
        reject(err);
      };
      
      relayWs.onclose = () => {
        console.log('Disconnected from relay');
        setBadge('', '#000000');
        relayWs = null;
      };
    } catch (err) {
      reject(err);
    }
  });
}

// Handle messages from relay server
async function handleRelayMessage(msg) {
  if (!attachedTabId) return;
  
  try {
    const debuggee = { tabId: attachedTabId };
    
    if (msg.method) {
      const result = await chrome.debugger.sendCommand(debuggee, msg.method, msg.params || {});
      
      // Send result back to relay
      if (relayWs && relayWs.readyState === WebSocket.OPEN) {
        relayWs.send(JSON.stringify({ id: msg.id, result }));
      }
    }
  } catch (err) {
    console.error('CDP command error:', err);
    if (relayWs && relayWs.readyState === WebSocket.OPEN) {
      relayWs.send(JSON.stringify({ id: msg.id, error: err.message }));
    }
  }
}

// Attach tab to relay
async function attachTab(tabId) {
  try {
    // Connect debugger to tab
    await chrome.debugger.attach({ tabId }, '1.3');
    
    // Enable required domains
    await chrome.debugger.sendCommand({ tabId }, 'Page.enable');
    await chrome.debugger.sendCommand({ tabId }, 'Runtime.enable');
    await chrome.debugger.sendCommand({ tabId }, 'Target.setAutoAttach', {
      autoAttach: true,
      flatten: true,
      waitForDebuggerOnStart: false
    });
    
    // Get target info
    const info = await chrome.debugger.sendCommand({ tabId }, 'Target.getTargetInfo');
    const targetInfo = info?.targetInfo;
    
    attachedTabId = tabId;
    
    // Connect to relay if not connected
    await connectToRelay();
    
    // Notify relay about attached tab
    if (relayWs && relayWs.readyState === WebSocket.OPEN) {
      relayWs.send(JSON.stringify({
        method: 'Target.attachedToTarget',
        params: {
          sessionId: `kiwi-tab-${tabId}`,
          targetInfo: { ...targetInfo, attached: true },
          waitingForDebugger: false
        }
      }));
    }
    
    setBadge('ON', '#00a651');
    return { success: true, tabId, targetId: targetInfo?.targetId };
    
  } catch (err) {
    console.error('Attach failed:', err);
    setBadge('!', '#ef4444');
    return { success: false, error: err.message };
  }
}

// Detach tab from relay
async function detachTab(tabId) {
  try {
    await chrome.debugger.detach({ tabId });
  } catch (err) {
    // May already be detached
  }
  
  attachedTabId = null;
  setBadge('', '#000000');
  
  // Notify relay
  if (relayWs && relayWs.readyState === WebSocket.OPEN) {
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
  
  if (relayWs && relayWs.readyState === WebSocket.OPEN) {
    relayWs.send(JSON.stringify({
      method,
      params,
      sessionId: `kiwi-tab-${source.tabId}`
    }));
  }
});

// Handle debugger detach (user closed DevTools, etc.)
chrome.debugger.onDetach.addListener((source, reason) => {
  if (source.tabId === attachedTabId) {
    attachedTabId = null;
    setBadge('', '#000000');
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
  }
  
  if (request.action === 'status') {
    sendResponse({
      attached: !!attachedTabId,
      connected: relayWs?.readyState === WebSocket.OPEN
    });
  }
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
  console.log('Kiwi Secure Relay v1.4.0 loaded - Hardcoded to VPS only');
});
