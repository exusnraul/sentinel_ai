#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  Sentinel AI — Unified Launcher
#  Runs from the PROJECT ROOT (sentinel_ai_semicolons/)
#
#  What this does:
#    1. Creates / activates a Python 3.12 venv inside backend/.venv
#    2. Installs all Python dependencies (via uv pip if available, else pip)
#    3. Starts the FastAPI backend on port 8001 (reload-enabled)
#    4. Installs Node.js dependencies if needed
#    5. Starts the Next.js frontend on port 8000
#
#  Usage:
#    chmod +x run.sh        (first time only — macOS/Linux)
#    ./run.sh
#
#  Prerequisites (all platforms):
#    • Python 3.12.x  — python3 or python must be in PATH
#    • Node.js 20+    — node + npm must be in PATH
#    • Tesseract OCR  — install separately (see below)
#    • GGUF model     — run: python3 download_model.py
#
#  Optional (recommended — speeds up dependency install):
#    • uv  →  pip install uv   OR   https://astral.sh/uv
#
#  Tesseract install:
#    macOS  : brew install tesseract
#    Ubuntu : sudo apt install tesseract-ocr
#    Windows: https://github.com/UB-Mannheim/tesseract/wiki
#
#  C++ compiler (required to build llama-cpp-python):
#    macOS  : xcode-select --install
#    Ubuntu : sudo apt install build-essential
#    Windows: Install Visual Studio Build Tools
#
#  Ports:
#    Backend  → http://localhost:8001  (FastAPI + WebSocket ws://localhost:8001/ws)
#    Frontend → http://localhost:8000  (Next.js dashboard)
# ════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[sentinel]${RESET} $*"; }
success() { echo -e "${GREEN}[✓]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[!]${RESET} $*"; }
error()   { echo -e "${RED}[✗]${RESET} $*"; exit 1; }

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}"
echo "  ███████╗███████╗███╗   ██╗████████╗██╗███╗   ██╗███████╗██╗     "
echo "  ██╔════╝██╔════╝████╗  ██║╚══██╔══╝██║████╗  ██║██╔════╝██║     "
echo "  ███████╗█████╗  ██╔██╗ ██║   ██║   ██║██╔██╗ ██║█████╗  ██║     "
echo "  ╚════██║██╔══╝  ██║╚██╗██║   ██║   ██║██║╚██╗██║██╔══╝  ██║     "
echo "  ███████║███████╗██║ ╚████║   ██║   ██║██║ ╚████║███████╗███████╗"
echo "  ╚══════╝╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝"
echo -e "${RESET}"
echo -e "  ${BOLD}AI Security  ·  Privacy-First DLP  ·  100% Local${RESET}"
echo ""

# ── Resolve paths ─────────────────────────────────────────────────────────────
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"
VENV_DIR="${BACKEND_DIR}/.venv"
REQUIREMENTS="${BACKEND_DIR}/requirements.txt"
MODEL_PATH="${ROOT_DIR}/models/qwen2.5-3b-instruct-q4_k_m.gguf"

BACKEND_PORT=8001
FRONTEND_PORT=8000

# ── Preflight checks ──────────────────────────────────────────────────────────
info "Running preflight checks..."

# Detect Python — accept python3 or python
PYTHON_CMD=""
for cmd in python3.12 python3 python; do
    if command -v "$cmd" &>/dev/null; then
        VER=$("$cmd" -c 'import sys; print(sys.version_info.major * 10 + sys.version_info.minor)')
        if [ "$VER" -ge 312 ]; then
            PYTHON_CMD="$cmd"
            break
        fi
    fi
done
[ -z "$PYTHON_CMD" ] && error "Python 3.12+ not found. Install from https://python.org or via your system package manager."

command -v node &>/dev/null || error "node not found. Install Node.js 20+ from https://nodejs.org"
command -v npm  &>/dev/null || error "npm not found. Install Node.js 20+ from https://nodejs.org"

PY_VERSION=$("$PYTHON_CMD" --version 2>&1 | awk '{print $2}')
NODE_VERSION=$(node --version)
info "Python ${PY_VERSION} · Node.js ${NODE_VERSION}"

# Detect uv (optional — used if available for faster installs)
USE_UV=false
if command -v uv &>/dev/null; then
    USE_UV=true
    info "uv detected — will use uv pip for faster installs."
else
    info "uv not found — using pip (install uv for faster installs: pip install uv)"
fi

# Tesseract check (non-fatal — backend runs without it but OCR won't work)
if command -v tesseract &>/dev/null; then
    success "Tesseract OCR found: $(tesseract --version 2>&1 | head -1)"
else
    warn "Tesseract OCR not found. Screenshot OCR will be disabled."
    warn "  macOS  : brew install tesseract"
    warn "  Ubuntu : sudo apt install tesseract-ocr"
    warn "  Windows: https://github.com/UB-Mannheim/tesseract/wiki"
fi

# Model check (non-fatal — system falls back to regex-only mode)
if [ -f "$MODEL_PATH" ] && [ -s "$MODEL_PATH" ]; then
    SIZE_MB=$(du -m "$MODEL_PATH" | awk '{print $1}')
    success "Model found (${SIZE_MB} MB): ${MODEL_PATH}"
else
    warn "GGUF model not found at: ${MODEL_PATH}"
    warn "  Run:  python3 download_model.py"
    warn "  System will start in regex-only mode until model is present."
fi

echo ""

# ── Backend — venv setup ──────────────────────────────────────────────────────
info "Setting up Python virtual environment..."

if [ ! -d "$VENV_DIR" ]; then
    info "Creating venv at ${VENV_DIR}..."
    if $USE_UV; then
        uv venv --python 3.12 "$VENV_DIR"
    else
        "$PYTHON_CMD" -m venv "$VENV_DIR"
    fi
    success "venv created."
else
    success "venv already exists — skipping creation."
fi

# Activate venv (cross-platform path)
if [ -f "${VENV_DIR}/bin/activate" ]; then
    # shellcheck source=/dev/null
    source "${VENV_DIR}/bin/activate"          # macOS / Linux
elif [ -f "${VENV_DIR}/Scripts/activate" ]; then
    # shellcheck source=/dev/null
    source "${VENV_DIR}/Scripts/activate"      # Windows Git Bash / MSYS2
else
    error "Could not find venv activation script at ${VENV_DIR}"
fi

success "venv activated ($(python --version))."

info "Installing / verifying Python dependencies..."
if $USE_UV; then
    uv pip install -r "$REQUIREMENTS" --quiet
else
    pip install --quiet --upgrade pip
    pip install --quiet -r "$REQUIREMENTS"
fi
success "Python dependencies installed."

echo ""

# ── Frontend — Node.js dependencies ──────────────────────────────────────────
info "Checking Node.js dependencies..."

if [ ! -d "${FRONTEND_DIR}/node_modules" ]; then
    info "node_modules not found — running npm install..."
    npm install --prefix "$FRONTEND_DIR" --silent
    success "npm packages installed."
else
    success "node_modules found — skipping npm install."
fi

echo ""

# ── Environment ───────────────────────────────────────────────────────────────
export NEXT_PUBLIC_BACKEND_PORT="${BACKEND_PORT}"
export NEXT_PUBLIC_BACKEND_URL="http://localhost:${BACKEND_PORT}"

info "Starting services..."
info "  Backend  → http://localhost:${BACKEND_PORT}"
info "  Frontend → http://localhost:${FRONTEND_PORT}"
echo ""

# ── Trap: kill all children on exit / Ctrl-C ─────────────────────────────────
cleanup() {
    echo ""
    warn "Shutting down Sentinel AI..."
    kill 0
}
trap cleanup EXIT INT TERM

# ── Start backend ─────────────────────────────────────────────────────────────
info "Starting FastAPI backend on port ${BACKEND_PORT}..."
cd "$BACKEND_DIR"
uvicorn main:app --host 0.0.0.0 --port "${BACKEND_PORT}" --reload &
BACKEND_PID=$!
cd "$ROOT_DIR"

sleep 2

# ── Start frontend ────────────────────────────────────────────────────────────
info "Starting Next.js frontend on port ${FRONTEND_PORT}..."
cd "$FRONTEND_DIR"
npm run dev -- --port "${FRONTEND_PORT}" &
FRONTEND_PID=$!
cd "$ROOT_DIR"

echo ""
success "Sentinel AI is running!"
echo ""
echo -e "  ${BOLD}Dashboard:${RESET}  http://localhost:${FRONTEND_PORT}"
echo -e "  ${BOLD}API:${RESET}        http://localhost:${BACKEND_PORT}/api/health"
echo -e "  ${BOLD}WebSocket:${RESET}  ws://localhost:${BACKEND_PORT}/ws"
echo -e "  ${BOLD}API Docs:${RESET}   http://localhost:${BACKEND_PORT}/docs"
echo ""
echo -e "  Press ${BOLD}Ctrl+C${RESET} to stop all services."
echo ""

# ── Wait for both processes ───────────────────────────────────────────────────
wait $BACKEND_PID $FRONTEND_PID
