# Kiwi Secure Browser Relay

A hardened, privacy-first browser relay for OpenClaw, developed by Shenzhen Kiwi Technology Co., Ltd.

## Features

- **No Telemetry**: Zero data collection or phoning home.
- **Hardcoded Endpoint**: Locked to secure VPS `ws://93.127.213.22:18792` — no dynamic IPs.
- **Safety Lock**: Prevents connection to unauthorized hosts.
- **Single-Purpose**: Tab relay only, minimal permissions.
- **Auto-Reconnect**: Exponential backoff reconnection on disconnect.

## Installation

1. Download ZIP → unzip.
2. `chrome://extensions/` → Developer mode → Load unpacked → select folder.
3. Pin icon → Click popup → "Attach Secure Tab" → Green status.

## How It Works

1. Click the extension icon to open the popup
2. Click "Attach Secure Tab" to attach the current tab
3. The tab's CDP (Chrome DevTools Protocol) events are relayed to the VPS
4. OpenClaw Gateway can then control the tab remotely

## Status Indicators

- **ON badge (green)**: Tab attached and connected
- **... badge (orange)**: Connecting to VPS
- **! badge (red)**: Error - check VPS connectivity

## Requirements

- Chrome/Chromium browser (not headless)
- VPS relay server must be running at `93.127.213.22:18792`
- Network access to the VPS (no firewall blocking)

## Security

This extension is hardcoded to only connect to `93.127.213.22`. Any attempt to connect to a different host will be rejected.

---

🦞 Powered by OpenClaw  
Leading the world in Liquid-Cooled EV Infrastructure and Secure AI Operations.
