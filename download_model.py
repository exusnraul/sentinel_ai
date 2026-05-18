#!/usr/bin/env python3
"""
Sentinel AI — Model Downloader
===============================
Downloads: Qwen2.5-3B-Instruct-Q4_K_M.gguf  (~2.0 GB)
Target:    ./models/qwen2.5-3b-instruct-q4_k_m.gguf

Requirements:
  • Python 3.7+  (no extra pip installs — stdlib only)
  • ~2.0 GB free disk space
  • Internet connection to huggingface.co
"""

import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────

MODEL_FILE = "qwen2.5-3b-instruct-q4_k_m.gguf"
HF_URL = (
    "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF"
    "/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf"
)

# Resolve models/ relative to this script's location (project root)
SCRIPT_DIR = Path(__file__).resolve().parent
MODEL_DIR  = SCRIPT_DIR / "models"
MODEL_PATH = MODEL_DIR / MODEL_FILE

# ── Progress bar ──────────────────────────────────────────────────────────────

def _progress(downloaded: int, chunk: int, total: int) -> None:
    """urllib.request.urlretrieve-compatible progress hook."""
    if total <= 0:
        # Content-Length not sent — show bytes downloaded only
        mb = downloaded * chunk / 1_048_576
        print(f"\r  ↓ {mb:.1f} MB downloaded...", end="", flush=True)
        return

    done = min(downloaded * chunk, total)
    pct  = done / total * 100
    mb_done  = done  / 1_048_576
    mb_total = total / 1_048_576

    bar_len = 40
    filled  = int(bar_len * done / total)
    bar     = "█" * filled + "░" * (bar_len - filled)

    print(
        f"\r  [{bar}] {pct:5.1f}%  {mb_done:.0f} / {mb_total:.0f} MB",
        end="",
        flush=True,
    )

# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print()
    print("╔══════════════════════════════════════════════════════════╗")
    print("║         Sentinel AI — Model Download Script             ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print()

    # 1. Ensure models/ directory exists
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    # 2. Skip if already downloaded
    if MODEL_PATH.exists() and MODEL_PATH.stat().st_size > 0:
        size_mb = MODEL_PATH.stat().st_size / 1_048_576
        print(f"✅  Model already exists:")
        print(f"    {MODEL_PATH}")
        print(f"    Size: {size_mb:.0f} MB")
        print()
        print("    Delete the file and re-run to force a fresh download.")
        return

    # 3. Download
    print(f"📥  Downloading model...")
    print(f"    URL:    {HF_URL}")
    print(f"    Target: {MODEL_PATH}")
    print(f"    Size:   ~2.0 GB — this may take a few minutes.")
    print()

    try:
        urllib.request.urlretrieve(HF_URL, MODEL_PATH, reporthook=_progress)
    except urllib.error.URLError as exc:
        print(f"\n\n❌  Network error: {exc.reason}")
        _cleanup()
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n⚠️   Download interrupted by user.")
        _cleanup()
        sys.exit(1)
    except Exception as exc:  # noqa: BLE001
        print(f"\n\n❌  Unexpected error: {exc}")
        _cleanup()
        sys.exit(1)

    print()  # newline after progress bar

    # 4. Verify
    if MODEL_PATH.exists() and MODEL_PATH.stat().st_size > 0:
        size_mb = MODEL_PATH.stat().st_size / 1_048_576
        print()
        print(f"✅  Download complete!")
        print(f"    {MODEL_PATH}  ({size_mb:.0f} MB)")
        print()
        print("    Start the backend:  cd backend && python main.py")
    else:
        print("❌  File is missing or empty after download.")
        _cleanup()
        sys.exit(1)


def _cleanup() -> None:
    """Remove a partial/corrupt download."""
    if MODEL_PATH.exists():
        MODEL_PATH.unlink()
        print(f"    Partial file removed: {MODEL_PATH}")


if __name__ == "__main__":
    main()
