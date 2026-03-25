// Kiwi Secure Browser Relay - Hardened by Shenzhen Kiwi Technology
const VPS_WS = 'ws://93.127.213.22:18792';
const ALLOWED_HOST = '93.127.213.22';

chrome.runtime.onInstalled.addListener(() => {
  console.log('Kiwi Secure Relay loaded - Hardcoded to VPS only');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'attach') {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      const tabId = tabs[0].id;
      chrome.storage.local.set({relayTab: tabId});
      sendResponse({status: 'secure-attached', tabId});
    });
    return true;
  }
  if (request.action === 'connect') {
    // Safety lock: only connect to hardcoded VPS
    if (request.host !== ALLOWED_HOST) {
      sendResponse({error: 'Host not allowed - Kiwi security lock'});
      return;
    }
    const ws = new WebSocket(VPS_WS);
    ws.onopen = () => console.log('Connected to Kiwi VPS');
    ws.onmessage = (event) => {
      // Relay commands to tab
      chrome.storage.local.get('relayTab', (data) => {
        if (data.relayTab) {
          chrome.tabs.sendMessage(data.relayTab, JSON.parse(event.data));
        }
      });
    };
    sendResponse({status: 'connected'});
  }
});
