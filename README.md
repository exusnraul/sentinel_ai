# Sentinel AI — Privacy-First Local DLP for the GenAI Era

> **An AI-powered Data Loss Prevention (DLP) system that runs 100% on-device. No data ever leaves the machine.**

Sentinel AI monitors clipboard activity, screenshots, and active application context in real-time. It uses a dual-engine pipeline — fast regex pattern matching combined with a locally-running quantized LLM — to detect, classify, and auto-redact sensitive data before it leaks into AI tools, browsers, or external services.

---

## Product Screenshots

| Security Dashboard | Threat Radar |
|---|---|
| ![Dashboard](product_screenshots/dashboard_1.png) | ![Threat Radar](product_screenshots/threat_radar.png) |

| Analytics | Policy Engine |
|---|---|
| ![Analytics](product_screenshots/analytics.png) | ![Policy Engine](product_screenshots/policy_engine.png) |

---

## System Architecture

![Architecture](product_screenshots/product_architecture.png)

### How it works

```
DATA SOURCES                LOCAL AGENT                  RISK ENGINE
────────────                ───────────                  ───────────
Clipboard        ──────────▶ Clipboard Service ──────────▶ Stage 1: Regex Scan  (< 1ms)
Screenshots (OCR) ─────────▶ Screenshot Service            Stage 2: AI Semantic  (500–3000ms)
Active Window     ─────────▶ Window Service     ──────────▶ Merge Results
                                                           Auto-Redact if HIGH/CRITICAL
                                                                │
                                                                ▼
                                                         WebSocket Broadcast
                                                    ws://localhost:8001/ws
                                                                │
                                                                ▼
                                                     Next.js Dashboard
                                                   http://localhost:8000
```

**All AI inference is local via llama-cpp-python (Metal GPU on Apple Silicon / CUDA on Nvidia). Zero network calls are made for analysis.**

---

## Problem Statement

The rise of GenAI tools (ChatGPT, Claude, Copilot, Gemini) has created a new class of enterprise security vulnerability: **unintentional data leakage via clipboard copy-paste and screen exposure**.

Developers routinely copy API keys, database credentials, customer PII, and internal architecture details — and paste them directly into AI chat interfaces or browser tools. Traditional DLP solutions are:

- **Cloud-dependent** — they send your data externally to analyse it, creating a privacy paradox
- **Context-blind** — regex-only scanners cannot distinguish `npm run dev` (safe) from a database connection string (critical)
- **Screen-unaware** — most DLP ignores what is visually displayed on screen (architecture diagrams, spreadsheets, code)
- **Expensive and complex** — enterprise DLP requires significant licensing and infrastructure

Sentinel AI solves this by bringing semantic understanding on-device, with zero cloud dependency.

---

## Core Features

| Feature | Description |
|---|---|
| **Clipboard Interception** | 1-second polling; detects every copy event; captures active app context |
| **Screenshot OCR** | Event-driven (Cmd+Shift+3/4) or live 5s polling mode; Tesseract OCR pipeline |
| **Dual-Engine Detection** | Regex for instant patterns + local LLM for semantic contextual reasoning |
| **Active App Context** | Detects Chrome vs VS Code vs Slack — same content, different risk scores |
| **Auto-Redaction** | HIGH/CRITICAL clipboard content is overwritten with `[TYPE_REDACTED]` tokens |
| **Real-Time Dashboard** | WebSocket-powered SOC-style UI; threat radar, activity feed, risk charts |
| **Policy Engine** | Toggle monitoring events, app detection lists, web detection lists |
| **Zero Telemetry** | No analytics, no crash reporting, no external API calls whatsoever |

---

## AI Models Used

Sentinel AI uses **Qwen2.5 Instruct** models in GGUF 4-bit quantized format, served locally via `llama-cpp-python`:

| Model | Size | Use Case |
|---|---|---|
| **Qwen2.5-3B-Instruct Q4_K_M** | ~2.0 GB | **Default.** Fast inference, suitable for most hardware. Recommended for M4/M3 Macs and mid-range laptops. |
| **Qwen2.5-7B-Instruct Q4_K_M** | ~4.7 GB | **Better reasoning.** Use when hardware supports it (16GB+ RAM, dedicated GPU). Higher accuracy on complex semantic threats. |

The `ai_engine.py` defaults to the 3B model. To switch to 7B, place the 7B GGUF in `models/` and set the `MODEL_PATH` environment variable:

```bash
export MODEL_PATH="../models/Qwen2.5-7B-Instruct-bnb-4bit.gguf"
```

If no model is found, the system falls back to **regex-only mode** — all monitoring still works, but semantic AI classification is disabled.

### Download the model

```bash
python3 download_model.py
```

This fetches `qwen2.5-3b-instruct-q4_k_m.gguf` (~2.0 GB) from Hugging Face into the `models/` directory using Python stdlib only (no extra pip installs).

---

## Hardware Requirements

> **Important:** This system runs a quantized LLM locally. Adequate hardware is required for real-time performance.

| Tier | Hardware | Performance |
|---|---|---|
| ✅ **Recommended** | Apple M4 / M3 / M2 Mac with 16 GB RAM | Excellent — Metal GPU offload; 15–30 tokens/sec |
| ✅ **Supported** | Apple M1 Mac with 16 GB RAM | Good — slightly slower inference |
| ✅ **Supported** | Windows/Linux laptop with NVIDIA GPU (8GB+ VRAM) | Good — CUDA acceleration |
| ⚠️ **Marginal** | Any machine with 8 GB RAM, no GPU | CPU-only inference; ~3–8 tokens/sec; noticeable lag |
| ❌ **Not recommended** | < 8 GB RAM | Model loading may OOM; regex-only mode still works |

The system is designed for **Apple Silicon Macs as the primary target** — `osascript` is used for active window detection (macOS-only feature). On Windows/Linux, the active app context returns `"Unknown"` but all other features work.

---

## System Permissions Required

> This system monitors clipboard and screen content at the OS level. The following permissions **must** be granted manually — the OS will prompt on first run.

### macOS (Required)

| Permission | Why It's Needed | Where to Grant |
|---|---|---|
| **Screen Recording** | Screenshot capture and OCR | System Settings → Privacy & Security → Screen Recording → enable for Terminal / your IDE |
| **Accessibility** | Clipboard monitoring, active window detection via `osascript` | System Settings → Privacy & Security → Accessibility → enable for Terminal |
| **Input Monitoring** | Keyboard event listener (`pynput`) for screenshot shortcut detection | System Settings → Privacy & Security → Input Monitoring → enable for Terminal |

> **If permissions are missing:** The backend will start but clipboard/screenshot services will silently fail or error. Check `backend/` terminal output for permission errors.

### Windows / Linux

- No special permissions are required
- `pynput` keyboard listener works without elevation on most distros
- Active window detection returns `"Unknown"` (no `osascript` equivalent implemented)

---

## Prerequisites

The project targets **Python 3.12.x** and **Node.js 20+**. All Python packages install into a local `.venv` automatically via `run.sh`.

> **Tip:** [uv](https://github.com/astral-sh/uv) is *optional but recommended* — it installs packages significantly faster than pip and manages the Python version automatically. `run.sh` detects uv automatically and falls back to plain pip if it is not installed.

### System-level dependencies (install manually)

| Dependency | Required | Tested Version | macOS | Ubuntu/Debian | Windows |
|---|---|---|---|---|---|
| **Python** | 3.12.x | **3.12.13** | [python.org](https://python.org) or `brew install python@3.12` | `sudo apt install python3.12` | [python.org](https://python.org) |
| **Node.js** | 20.x+ | **v24.15.0** | `brew install node` | `sudo apt install nodejs npm` | [nodejs.org](https://nodejs.org) |
| **Tesseract OCR** | Recommended | **5.5.2** | `brew install tesseract` | `sudo apt install tesseract-ocr` | [UB Mannheim installer](https://github.com/UB-Mannheim/tesseract/wiki) |
| **C++ compiler** | For LLM build | — | `xcode-select --install` | `sudo apt install build-essential` | Visual Studio Build Tools |
| **uv** *(optional)* | No | — | `pip install uv` | `pip install uv` | `pip install uv` |
| **Git** | Yes | — | Pre-installed | `sudo apt install git` | [git-scm.com](https://git-scm.com) |

**Python packages** are installed automatically by `run.sh` into `backend/.venv`.  
**Node packages** are installed automatically by `run.sh` via `npm install`.

---

## Quick Start

### 1. Clone the repository

```bash
git clone <repo-url>
cd sentinel_ai_semicolons
```

### 2. Download the AI model

```bash
python3 download_model.py
```

This places `qwen2.5-3b-instruct-q4_k_m.gguf` (~2.0 GB) into `models/` using Python stdlib only. Skip this step to run in regex-only mode.

### 3. Run everything with one command

**macOS / Linux:**
```bash
chmod +x run.sh   # first time only
./run.sh
```

**Windows (Git Bash / MSYS2):**
```bash
bash run.sh
```

The script will:
1. Detect Python 3.12 (`python3.12` → `python3` → `python`, whichever works)
2. Create `backend/.venv` — using `uv venv` if uv is installed, else `python -m venv`
3. Install all Python dependencies — using `uv pip` if available, else `pip`
4. Warn (non-fatal) if Tesseract OCR or the GGUF model is missing
5. Run `npm install` in `frontend/` if `node_modules` is absent
6. Start the **FastAPI backend on port 8001** with `--reload`
7. Start the **Next.js frontend on port 8000**
8. `Ctrl+C` stops both services cleanly

### 4. Open the dashboard

```
http://localhost:8000
```

### 5. Grant OS permissions on first run

**macOS only:** The backend will trigger system prompts for **Screen Recording**, **Accessibility**, and **Input Monitoring**. Grant all three via System Settings → Privacy & Security, then restart the backend.

**Linux:** No special permissions needed. `pynput` works without elevation on most distros.

**Windows:** No special permissions needed. Run terminal as a standard user.

---

## Manual Start (Alternative)

If you prefer to start services separately:

**Terminal 1 — Backend (macOS / Linux):**
```bash
cd backend
python3.12 -m venv .venv          # or: uv venv --python 3.12 .venv
source .venv/bin/activate
pip install -r requirements.txt   # or: uv pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

**Terminal 1 — Backend (Windows cmd / PowerShell):**
```bat
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

**Terminal 2 — Frontend (all platforms):**
```bash
cd frontend
npm install
npm run dev -- --port 8000
```

---

## Project Structure

```
sentinel_ai_semicolons/
│
├── run.sh                        ← Unified launcher (START HERE)
├── download_model.py             ← Downloads Qwen2.5-3B GGUF model
│
├── backend/
│   ├── main.py                   ← FastAPI app, all REST routes, startup
│   ├── database.py               ← SQLite: events, employees, devices, SMTP
│   ├── requirements.txt          ← Python dependencies
│   ├── run.sh                    ← Legacy shim → delegates to root run.sh
│   ├── .venv/                    ← Python virtual environment (auto-created)
│   ├── api/
│   │   └── websocket.py          ← WebSocket connection manager + broadcast
│   └── services/
│       ├── monitor_state.py      ← Singleton: all feature flags
│       ├── clipboard_service.py  ← 1s polling, clipboard diff, active window
│       ├── screenshot_service.py ← Event-driven OCR + optional live mode
│       ├── risk_engine.py        ← Orchestrates: regex → sanitize → AI → merge
│       ├── ai_engine.py          ← LLM init, prompt, inference, JSON parse
│       ├── sanitizer.py          ← Regex patterns + content redaction
│       └── window_service.py     ← macOS active window via AppleScript
│
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── globals.css       ← Tailwind v4 @theme tokens, keyframes
│       │   ├── layout.tsx        ← Root HTML, fonts, SEO
│       │   └── page.tsx          ← Entry → <Dashboard />
│       └── components/
│           ├── Dashboard.tsx     ← Main orchestrator, WebSocket, state
│           ├── ThreatRadar.tsx   ← SVG radar with sweep animation
│           ├── ActivityFeed.tsx  ← Real-time event stream
│           ├── LatestAlert.tsx   ← Prominent alert card
│           ├── RiskTrend.tsx     ← Recharts area chart
│           ├── SanitizePanel.tsx ← Original → Sanitized comparison
│           ├── PolicyControl.tsx ← DLP policy toggles (synced to backend)
│           ├── AnalyticsView.tsx ← Full analytics page
│           ├── ActivityStreamView.tsx ← Full activity stream
│           └── SettingsView.tsx  ← Employees, devices, SMTP, data mgmt
│
├── models/                       ← GGUF model files (git-ignored)
│   └── qwen2.5-3b-instruct-q4_k_m.gguf
│
└── product_screenshots/          ← UI screenshots and architecture diagram
```

---

## API Reference

### Ports

| Service | Port | URL |
|---|---|---|
| Backend (FastAPI) | **8001** | `http://localhost:8001` |
| Frontend (Next.js) | **8000** | `http://localhost:8000` |
| WebSocket | **8001** | `ws://localhost:8001/ws` |
| API Docs (Swagger) | **8001** | `http://localhost:8001/docs` |

### Key Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Server health + hostname |
| `GET` | `/api/policies` | All monitoring feature flags |
| `PUT` | `/api/policies` | Partial update of flags (takes effect immediately) |
| `GET` | `/api/events` | Paginated events (limit, offset, risk_level) |
| `DELETE` | `/api/events/clear` | Clear all stored events |
| `GET/POST` | `/api/employees` | List / create employees |
| `GET` | `/api/devices` | List all registered devices |
| `GET/PUT` | `/api/settings/smtp` | SMTP alert configuration |
| `POST` | `/api/settings/smtp/test` | Send test email |

### WebSocket Event Schema

```json
{
  "id": "uuid-string",
  "timestamp": 1715000000.0,
  "source": "clipboard | screenshot",
  "original_content": "raw detected text",
  "original_content_length": 42,
  "sanitized_content": "redacted text with [TYPE_REDACTED] tokens",
  "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
  "confidence": 0.95,
  "category": "AWS_CREDENTIALS | PII | SOURCE_CODE | DATABASE_CREDS | SAFE_COMMAND",
  "reason": "One-sentence AI explanation of the classification",
  "recommended_action": "What the user should do"
}
```

---

## Monitoring Policies

All flags are live-updated via `PUT /api/policies` — no restart needed.

| Flag | Default | Description |
|---|---|---|
| `clipboard_enabled` | `true` | Clipboard analysis loop |
| `screenshot_enabled` | `true` | Event-driven screenshot OCR |
| `live_monitor_enabled` | `false` | Continuous 5s screenshot polling (resource-intensive) |
| `file_upload_detection_enabled` | `false` | Monitor file uploads to AI websites |
| `block_high_critical` | `true` | Auto-overwrite clipboard on HIGH/CRITICAL |
| `warn_medium` | `true` | Partial redact on MEDIUM |
| `auto_sanitize` | `true` | Regex redaction before store/broadcast |
| `log_all` | `true` | Persist all events to SQLite |
| `allow_low` | `true` | Silent pass-through on LOW risk |
| `monitored_apps` | 21 apps | Comma-separated list of apps to watch |
| `monitored_websites` | 16 sites | AI websites for web detection |

---

## Detection Capabilities

### Regex Patterns (Stage 1 — instant)

- AWS Access Key IDs (`AKIA[0-9A-Z]{16}`)
- AWS Secret Access Keys
- Generic API keys and tokens
- Email addresses (PII)
- Credit card numbers (Luhn-validated)
- Database connection strings
- Internal IP addresses and URLs
- Private SSH/TLS keys

### AI Semantic Classification (Stage 2 — contextual)

The LLM receives: raw text + source type + active application name.

**Context-aware scoring example:**
- `postgres://admin:secret@10.0.0.5/prod` in **VS Code** → `MEDIUM` (contained)
- `postgres://admin:secret@10.0.0.5/prod` in **Chrome/ChatGPT** → `CRITICAL` (active leak)
- `npm run dev` in any app → `LOW` (public command)

---

## Debugging

### Backend won't start

```bash
# macOS / Linux
cd backend && source .venv/bin/activate && python main.py

# Windows
cd backend && .venv\Scripts\activate && python main.py
```

### Model loading fails / crashes

```
Error loading model: ...
```

- Re-download: `python3 download_model.py` (checks for corruption)
- Reduce context: set `n_ctx=1024` in `ai_engine.py` if you get OOM errors
- Force CPU: set `n_gpu_layers=0` in `ai_engine.py` (slower but always works)
- CUDA users: ensure the CUDA-specific wheel was installed (see `requirements.txt` note)

### Clipboard not detected

- **macOS:** Verify **Accessibility** permission is granted to your terminal app
- **Linux:** Install a clipboard backend — `sudo apt install xclip` or `sudo apt install xsel`
- **Windows:** Should work out of the box via `pyperclip` + `pywin32`
- Test: `python3 -c "import pyperclip; print(pyperclip.paste())"`

### Screenshot OCR not working

- Test Tesseract is installed: `tesseract --version`
- **macOS:** `brew install tesseract`
- **Ubuntu:** `sudo apt install tesseract-ocr`
- **Windows:** Download from [UB Mannheim](https://github.com/UB-Mannheim/tesseract/wiki); add install path to system `PATH`
- **macOS:** Also verify **Screen Recording** permission is granted to terminal

### pynput / Input Monitoring error (macOS only)

```
This process is not trusted! Input event monitoring will not be possible.
```

- Go to **System Settings → Privacy & Security → Input Monitoring**
- Add and enable your terminal app (Terminal.app, iTerm2, Warp, VS Code, etc.)

### Frontend shows "Disconnected"

- Verify backend is running: `curl http://localhost:8001/api/health`
- Check browser console for WebSocket errors — frontend auto-retries every 5 s
- Ensure no firewall or antivirus is blocking `localhost:8001`

### Port already in use

```bash
# macOS / Linux
lsof -ti:8001 | xargs kill -9
lsof -ti:8000 | xargs kill -9

# Windows (PowerShell)
Get-Process -Id (Get-NetTCPConnection -LocalPort 8001).OwningProcess | Stop-Process
Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process
```

---

## Why This Cannot Be Dockerized

Sentinel AI has **fundamental architectural constraints** that make Docker containerisation incompatible with its core functionality:

1. **Clipboard access** — `pyperclip` requires access to the host OS clipboard subsystem. Docker containers are isolated and cannot access the host clipboard. No workaround exists at the container level.

2. **Screen capture** — `mss` (screen capture) and `pytesseract` (OCR) require a real display/framebuffer. Docker containers have no display by default. Even with X11 forwarding or VNC, this adds significant complexity and latency that breaks real-time monitoring.

3. **Active window detection** — `osascript` (AppleScript) runs macOS system commands. This is a host-OS API — it cannot be called from inside a container. On Linux, `xdotool` / `wnck` similarly require host display access.

4. **Input monitoring (pynput)** — Keyboard event listening requires OS-level input device access (macOS Input Monitoring permission, Linux `/dev/input`). Containers cannot hold these permissions.

5. **Metal / CUDA GPU access for LLM** — While possible with `--gpus all` on Linux/CUDA, the Apple Silicon Metal backend (`n_gpu_layers=-1`) is entirely unavailable inside Docker on macOS (Docker Desktop uses a Linux VM, not the host Metal stack). The LLM would run CPU-only at drastically reduced speed.

**The system is designed to run natively on the developer/analyst's machine — this is intentional and fundamental to the privacy-first, local-only architecture.**

---

## Security Model

| Principle | Implementation |
|---|---|
| **No data leaves the device** | Local LLM via llama-cpp-python; zero external API calls |
| **Zero telemetry** | No analytics, crash reporting, or usage tracking |
| **Clipboard override** | HIGH/CRITICAL content auto-replaced in OS clipboard |
| **Display-safe redaction** | Frontend always shows `[TYPE_REDACTED]` tokens, never raw secrets |
| **Audit trail** | All events persisted to local SQLite (`backend/sentinel.db`) |
| **Configurable scope** | Per-app and per-website monitoring lists; toggleable per event type |

---

## Competitive Comparison

| Solution | Cloud Required | Local AI | Real-Time | Screenshot OCR | Free |
|---|---|---|---|---|---|
| **Sentinel AI** | **No** | **Yes** | **Yes** | **Yes** | **Yes** |
| Symantec DLP | Yes | No | Yes | Yes | No |
| Microsoft Purview | Yes | No | Yes | Yes | No |
| Nightfall AI | Yes | No | Partial | No | No |
| Google DLP API | Yes | No | No | No | Paid API |

---

## Tech Stack & Exact Dependency Versions

> All versions below are pinned from the live environment (`uv pip list` on Python 3.12.13, macOS Apple Silicon). These are the same versions written into `requirements.txt`.

### Backend — Python `3.12.13`

| Package | Pinned Version | Purpose |
|---|---|---|
| `fastapi` | **0.136.1** | REST API framework |
| `uvicorn` | **0.47.0** | ASGI server |
| `starlette` | **1.0.0** | FastAPI dependency / middleware |
| `websockets` | **16.0** | WebSocket server |
| `pydantic` | **2.13.4** | Data validation |
| `pydantic-core` | **2.46.4** | Pydantic Rust core |
| `llama-cpp-python` | **0.3.23** | Local GGUF LLM inference (Metal / CUDA / CPU) |
| `mss` | **10.2.0** | Cross-platform screen capture |
| `Pillow` | **12.2.0** | Image processing |
| `pytesseract` | **0.3.13** | Tesseract OCR wrapper |
| `pyperclip` | **1.11.0** | Clipboard read/write |
| `pynput` | **1.8.2** | Keyboard event listener |
| `requests` | **2.34.2** | HTTP client |
| `anyio` | **4.13.0** | Async I/O |
| `jinja2` | **3.1.6** | Template engine |
| `numpy` | **2.4.4** | Numerical ops (llama-cpp dep) |
| `diskcache` | **5.6.3** | Disk-based caching |

> **Platform note:** `pynput` automatically installs OS-specific bindings at install time — `pyobjc-*` on macOS, `python3-xlib` or `evdev` on Linux, `pywin32` on Windows. These do **not** need to be listed in `requirements.txt`.

**System OCR engine (not a pip package):** Tesseract `5.5.2`
- macOS: `brew install tesseract`
- Ubuntu: `sudo apt install tesseract-ocr`
- Windows: [UB Mannheim installer](https://github.com/UB-Mannheim/tesseract/wiki)

### Frontend — Node.js `v24.15.0` / npm `11.12.1`

> Versions below are resolved from `frontend/package-lock.json` — exact, not ranges.

| Package | Resolved Version | Purpose |
|---|---|---|
| `next` | **16.2.6** | React framework (App Router) |
| `react` | **19.2.4** | UI library |
| `react-dom` | **19.2.4** | React DOM renderer |
| `framer-motion` | **12.38.0** | Animations |
| `recharts` | **3.8.1** | Charts (risk trend, analytics) |
| `lucide-react` | **1.14.0** | Icon set |
| `tailwindcss` | **4.3.0** | CSS framework (v4 `@theme` syntax) |
| `typescript` | **5.9.3** | Type system |
| `clsx` | **2.1.1** | Class name utility |
| `tailwind-merge` | **3.6.0** | Tailwind class merging |

---

## Future Roadmap

- File upload scanning before transmission to cloud services
- Email gateway integration for outbound email scanning
- USB/removable media monitoring
- Multi-user shared dashboard with auth
- RAG memory — user feedback embedded into a vector store for adaptive detection
- Compliance report generation (GDPR, HIPAA, SOC2)
- Windows active window detection (`pygetwindow`)
