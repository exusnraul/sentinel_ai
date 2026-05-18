#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────
#  backend/run.sh — legacy shim
#
#  This file is kept for backwards compatibility only.
#  The canonical launcher is the root-level run.sh which:
#    • Sets up the Python venv
#    • Installs all dependencies
#    • Starts both backend (port 8001) and frontend (port 8000)
#
#  Use from the project root:
#    ./run.sh
# ────────────────────────────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
exec "${ROOT_DIR}/run.sh" "$@"
