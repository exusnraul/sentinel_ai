# Sentient Gateway

**Semantic Firewall + Local AI Router** — A Chrome extension (Manifest V3) for enterprise data protection and local AI routing on ChatGPT, Claude, and Gemini.

## Features

### 1. Data Loss Prevention (DLP)
Monitors all text input in real-time and scans for sensitive data before it's sent to cloud AI services.

- **Real-time scanning**: Detects sensitive data as you type across multiple categories:
  - OpenAI API Keys (`sk-...`)
  - Google API Keys (`AIza...`)
  - GitHub Tokens (`ghp_...`, `gho_...`, etc.)
  - Email Addresses
  - Social Security Numbers (SSN)
  - Credit Card Numbers
  - Private Keys (`-----BEGIN ... PRIVATE KEY-----`)
  - AWS Access Keys (`AKIA...`)
  - Generic Credentials (password, secret, token, api_key patterns)
- **Glassmorphism warning banner**: Slides down from the top with a 3-second cooldown before "Ignore & Send" is available
- **Incremental detection**: New sensitive types found while typing are automatically added to the banner
- **Paste detection**: Pasting content with sensitive data is fully captured and flagged
- **Security event logging**: All detections are logged to storage with timestamp and platform name
- **Warning modal**: Clicking send (or Enter) while sensitive data is present shows a confirmation modal

### 2. Local Mode (Ollama)
Route prompts to a local LLM instead of sending them to cloud AI services.

- **Floating chat panel**: 380×520px glassmorphism panel with conversation history, loading indicator, and model name display
- **Ollama integration**: Routes prompts through `http://127.0.0.1:11434` via the service worker
- **Auto-model detection**: Detects the first available model from Ollama's `/api/tags`
- **Toggle on/off**: Switch between Local and Cloud mode from the popup dashboard

### 3. Dashboard Popup
Real-time analytics and controls in the extension popup.

- **Mode toggle**: Segmented control to switch Local/Cloud mode
- **Savings counter**: Animated token and dollar savings counter ($0.03/1K tokens)
- **Traffic gauges**: Visual gauges showing local vs. cloud request counts
- **Security event log**: Scrollable list of recent DLP events with labels and timestamps
- **Ollama status**: Pulsing green dot when Ollama is detected, red when unavailable

### 4. Cost Tracking
- Tokens saved are calculated as `(prompt + response) / 4`
- Dollar savings at $0.03 per 1,000 tokens
- Persisted in `chrome.storage.local`
- Reset-able from the popup

## Installation

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `sentient-gateway` directory

## Prerequisites

### Ollama Setup
1. Install [Ollama](https://ollama.ai)
2. Pull a model: `ollama pull llama3.2:3b` (or any model of your choice)
3. Configure Ollama to accept extension origins:

   ```bash
   # Temporary (current terminal session):
   OLLAMA_ORIGINS=* ollama serve

   # Permanent (macOS):
   launchctl setenv OLLAMA_ORIGINS "*"
   # Then quit and relaunch Ollama from the menu bar
   ```

   Without this step, Ollama returns `403 Forbidden` for requests from the `chrome-extension://` origin.

## Usage

### Cloud Mode (Default)
- Every prompt to ChatGPT/Claude/Gemini is monitored by DLP
- Sensitive text is flagged with a banner and optional modal confirmation
- Nothing is blocked — you choose to ignore or cancel

### Local Mode
1. Click the extension icon → toggle **Local**
2. A floating chat panel appears on the page
3. Type a message and hit Enter or click the send button
4. The prompt is routed to your local Ollama model
5. The response appears in the panel
6. Switch back to **Cloud** to hide the panel

### DLP Warning
- **Banner**: Red glassmorphism banner slides down showing detected types
- **3-second countdown**: The "Ignore & Send" button is disabled for 3 seconds
- **Clicking "Ignore & Send"**: Allows the send to proceed (for Cloud mode) or acknowledges the warning
- **Cancel button** on modal: Clears the warning without sending

## Architecture

```
┌─────────────────────────────┐
│   ChatGPT/Claude/Gemini     │
│   (Host Page)               │
│                             │
│  ┌───────────────────────┐  │
│  │ content.js            │  │
│  │ ─ DLP monitor         │  │
│  │ ─ Chat panel UI       │  │
│  │ ─ Chrome API wrapper  │  │
│  └───────┬───────────────┘  │
└──────────┼──────────────────┘
           │ chrome.runtime.sendMessage
           ▼
┌─────────────────────────────┐
│ background.js               │
│ (Service Worker)            │
│ ─ Message hub               │
│ ─ routeToOllama()           │
│ ─ detectOllamaModel()       │
│ ─ Storage (stats, events)   │
│                             │
│ └─ fetch() ──► Ollama API   │
│    127.0.0.1:11434          │
└─────────────────────────────┘
           ▲
           │ chrome.runtime.connect
┌─────────────────────────────┐
│ popup.html / popup.js       │
│ (Dashboard)                 │
│ ─ Savings counter           │
│ ─ Traffic gauges            │
│ ─ Security log              │
│ ─ Mode toggle               │
└─────────────────────────────┘
```

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest with permissions and host_permissions |
| `content.js` | Content script: DLP detection, banner, chat panel UI |
| `background.js` | Service worker: message routing, Ollama API calls, storage |
| `offscreen.html` / `offscreen.js` | Offscreen document (fallback CORS proxy — currently unused) |
| `popup.html` / `popup.js` | Extension popup dashboard |
| `styles.css` | Popup CSS (Tailwind replacement) |
| `icons/` | 16/48/128 PNG icons |

## Security Notes

- All sensitive data detection happens **locally** in the content script — nothing is sent anywhere for analysis
- Local Mode routes prompts to Ollama on `127.0.0.1:11434` — data never leaves your machine
- DLP events are stored in `chrome.storage.local` (not synced to cloud)
- No data is logged or tracked outside of what's displayed in the dashboard
