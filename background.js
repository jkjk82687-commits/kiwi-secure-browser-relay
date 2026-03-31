// Kiwi Secure Browser Relay - Hardened by Shenzhen Kiwi Technology
// Connects to VPS relay server for secure tab attachment

const VPS_WS = 'ws://93.127.213.22:18792';
const VPS_HTTP = 'http://93.127.213.22:18792';
const ALLOWED_HOST = '93.127.213.22';

let relayWs = null;
let relayTab = null;
let reconnectTimer = null;
let reconnectAttempt = 0;

const BADGE = {
  on: { text: 'ON', color: '#00a651' },
  off: { text: '', color: '#000000' },
  connecting: { text: '…', color: '#F59E0B' },
  error: { text: '!', color: '#B91C1C' },
};

function setBadge(tabId, kind) {
  const cfg = BADGE[kind];
  chrome.action.setBadgeText({ tabId, text: cfg.text });
  chrome.action.setBadgeBackgroundColor({ tabId, color: cfg.color });
}

async function checkRelayServer() {
  try {
    const res = await fetch(`${VPS_HTTP}/`, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function connectRelay() {
  if (relayWs && relayWs.readyState === WebSocket.OPEN) return true;
  
  // Check if server is reachable first
  const reachable = await checkRelayServer();
  if (!reachable) {
    throw new Error(`Relay server not reachable at ${VPS_HTTP}`);
  }

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(VPS_WS);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Connection timeout'));
    }, 5000);

    ws.onopen = () => {
      clearTimeout(timeout);
      relayWs = ws;
      reconnectAttempt = 0;
      console.log('Kiwi Secure Relay: Connected to VPS');
      resolve(true);
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('WebSocket error'));
    };

    ws.onclose = () => {
      relayWs = null;
      scheduleReconnect();
    };

    ws.onmessage = (event) => {
      handleRelayMessage(event.data);
    };
  });
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000);
  reconnectAttempt++;
  console.log(`Kiwi: Reconnecting in ${delay}ms (attempt ${reconnectAttempt})`);
  reconnectTimer = setTimeout(async () => {
    try {
      await connectRelay();
      if (relayTab) {
        setBadge(relayTab, 'on');
      }
    } catch (e) {
      console.warn('Reconnect failed:', e.message);
    }
  }, delay);
}

function handleRelayMessage(data) {
  try {
    const msg = JSON.parse(data);
    // Handle incoming CDP commands from relay
    if (msg.method && relayTab) {
      chrome.debugger.sendCommand({ tabId: relayTab }, msg.method, msg.params)
        .then(result => {
          sendToRelay({ id: msg.id, result });
        })
        .catch(error => {
          sendToRelay({ id: msg.id, error: error.message });
        });
    }
  } catch (e) {
    console.error('Failed to parse relay message:', e);
  }
}

function sendToRelay(payload) {
  if (relayWs && relayWs.readyState === WebSocket.OPEN) {
    relayWs.send(JSON.stringify(payload));
  }
}

async function attachTab(tabId) {
  try {
    // Attach debugger to the tab
    await chrome.debugger.attach({ tabId }, '1.3');
    
    // Enable necessary domains
    await chrome.debugger.sendCommand({ tabId }, 'Page.enable');
    await chrome.debugger.sendCommand({ tabId }, 'Runtime.enable');
    await chrome.debugger.sendCommand({ tabId }, 'Network.enable');
    
    // Get target info
    const info = await chrome.debugger.sendCommand({ tabId }, 'Target.getTargetInfo');
    const targetId = info.targetInfo?.targetId;
    
    relayTab = tabId;
    await chrome.storage.local.set({ relayTab: tabId, targetId });
    
    setBadge(tabId, 'on');
    
    // Notify relay server
    sendToRelay({
      type: 'tab_attached',
      targetId,
      url: (await chrome.tabs.get(tabId)).url
    });
    
    return { success: true, targetId };
  } catch (error) {
    setBadge(tabId, 'error');
    throw error;
  }
}

async function detachTab(tabId) {
  try {
    await chrome.debugger.detach({ tabId });
  } catch (e) {
    // Already detached
  }
  
  relayTab = null;
  await chrome.storage.local.remove(['relayTab', 'targetId']);
  setBadge(tabId, 'off');
  
  sendToRelay({ type: 'tab_detached' });
}

// Handle debugger events
chrome.debugger.onEvent.addListener((source, method, params) => {
  if (source.tabId === relayTab) {
    sendToRelay({
      type: 'cdp_event',
      method,
      params
    });
  }
});

// Handle debugger detach (user closed DevTools or navigated)
chrome.debugger.onDetach.addListener(async (source, reason) => {
  if (source.tabId === relayTab) {
    relayTab = null;
    setBadge(source.tabId, 'off');
    await chrome.storage.local.remove(['relayTab', 'targetId']);
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStatus') {
    sendResponse({
      connected: relayWs?.readyState === WebSocket.OPEN,
      tabAttached: relayTab !== null,
      vpsAddress: VPS_WS
    });
    return true;
  }
  
  if (request.action === 'attach') {
    (async () => {
      try {
        await connectRelay();
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
          sendResponse({ error: 'No active tab' });
          return;
        }
        const result = await attachTab(tab.id);
        sendResponse(result);
      } catch (error) {
        sendResponse({ error: error.message });
      }
    })();
    return true;
  }
  
  if (request.action === 'detach') {
    (async () => {
      if (relayTab) {
        await detachTab(relayTab);
        sendResponse({ success: true });
      } else {
        sendResponse({ error: 'No tab attached' });
      }
    })();
    return true;
  }
  
  if (request.action === 'connect') {
    // Safety lock: only connect to hardcoded VPS
    if (request.host !== ALLOWED_HOST) {
      sendResponse({ error: 'Host not allowed - Kiwi security lock' });
      return true;
    }
    connectRelay()
      .then(() => sendResponse({ status: 'connected' }))
      .catch(e => sendResponse({ error: e.message }));
    return true;
  }
});

// Restore state on startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('Kiwi Secure Relay loaded - Hardcoded to VPS only');
});

// Reconnect on startup if was attached
chrome.runtime.onStartup.addListener(async () => {
  const stored = await chrome.storage.local.get(['relayTab']);
  if (stored.relayTab) {
    try {
      await chrome.tabs.get(stored.relayTab);
      await connectRelay();
      relayTab = stored.relayTab;
      setBadge(relayTab, 'on');
    } catch {
      // Tab no longer exists
      await chrome.storage.local.remove(['relayTab', 'targetId']);
    }
  }
});
