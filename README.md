# Kiwi Secure Browser Relay

A hardened, privacy-first browser relay for OpenClaw, developed by Shenzhen Kiwi Technology Co., Ltd.

## Features

- **No Telemetry**: Zero data collection or phoning home.
- **Hardcoded Endpoint**: Locked to secure VPS `ws://93.127.213.22:18792` — no dynamic IPs.
- **Safety Lock**: Prevents connection to unauthorized hosts.
- **Single-Purpose**: Tab relay only, minimal permissions.

## Installation

1. Download ZIP → unzip.
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked** → select the folder
5. Pin the extension icon

## Usage

1. Click the extension icon on any tab
2. Click **"Attach Secure Tab"**
3. Badge shows **ON** when connected
4. Tab is now relayed to the VPS

## Version History

- **1.4.0**: Fixed popup button handler, added proper CDP relay support
- **1.3.0**: Initial release

---

🦞 Powered by OpenClaw

**Shenzhen Kiwi Technology Co., Ltd.**  
Leading the world in Liquid-Cooled EV Infrastructure and Secure AI Operations.
