"""
Screenshot monitoring service.

Two distinct modes:
─────────────────────────────────────────────────────────────────────────────
1. EVENT-DRIVEN (screenshot_enabled=True, live_monitor_enabled=False)
   Listens for the OS screenshot keyboard shortcut via pynput:
   • macOS: Cmd+Shift+4 or Cmd+Shift+3
   • Windows/Linux: Print Screen key
   On each detected event, captures the screen once, runs OCR + AI analysis.

2. LIVE MONITORING (live_monitor_enabled=True)
   Continuously captures the screen every LIVE_INTERVAL seconds.
   Requires screenshot_enabled to also be True.
   High resource usage — disabled by default.
─────────────────────────────────────────────────────────────────────────────
"""

import asyncio
import hashlib
import logging
import sys
import threading

# pyrefly: ignore [missing-import]
import mss
import pytesseract
from PIL import Image
from services.risk_engine import risk_engine
from services.monitor_state import monitor_state
from api.websocket import notifier

logger = logging.getLogger(__name__)

# Minimum OCR text length worth analysing (filters blank / icon-only screens)
MIN_OCR_CHARS = 20

# Only broadcast OCR results at or above this risk level to avoid UI noise
NOTIFY_THRESHOLD = {"MEDIUM", "HIGH", "CRITICAL"}

# Live mode continuous polling interval (seconds)
LIVE_INTERVAL = 5.0

# ── Shared event trigger for the keyboard listener ─────────────────────────
# The pynput thread sets this; the asyncio loop picks it up.
_screenshot_event = threading.Event()


def _setup_keyboard_listener():
    """
    Install a pynput GlobalHotKeys listener for the OS screenshot shortcut.
    Sets _screenshot_event when the user presses:
      • macOS: Cmd+Shift+4 or Cmd+Shift+3
      • Windows/Linux: Print Screen
    Runs in a daemon thread so it doesn't block the event loop.
    Falls back gracefully if pynput is unavailable.
    """
    try:
        from pynput import keyboard

        if sys.platform == "darwin":
            # macOS screenshot shortcuts
            hotkeys = {
                "<cmd>+<shift>+4": lambda: _screenshot_event.set(),
                "<cmd>+<shift>+3": lambda: _screenshot_event.set(),
            }
        else:
            # Windows / Linux — Print Screen
            def on_press(key):
                try:
                    if key == keyboard.Key.print_screen:
                        _screenshot_event.set()
                except Exception:
                    pass

            listener = keyboard.Listener(on_press=on_press)
            listener.daemon = True
            listener.start()
            logger.info("Screenshot event listener started (Print Screen / Linux/Win)")
            return

        listener = keyboard.GlobalHotKeys(hotkeys)
        listener.daemon = True
        listener.start()
        logger.info("Screenshot event listener started (Cmd+Shift+3/4 / macOS)")

    except ImportError:
        logger.warning(
            "pynput not installed — screenshot event detection unavailable. "
            "Install it with: pip install pynput"
        )
    except Exception as exc:
        logger.warning("Could not start screenshot keyboard listener: %s", exc)


# ── Core capture + analyse helper ──────────────────────────────────────────

async def _capture_and_analyse(last_hash_ref: list, is_live: bool = False):
    """
    Capture the primary screen, run OCR, and analyse with the risk engine.
    `last_hash_ref` is a one-element list used to track OCR deduplication.
    Returns the risk_level string, or None if skipped.
    """
    loop = asyncio.get_event_loop()

    with mss.mss() as sct:
        monitor = sct.monitors[1]
        sct_img = sct.grab(monitor)
        img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")

    # OCR — run in thread to avoid blocking the asyncio event loop
    text: str = await loop.run_in_executor(
        None,
        lambda: pytesseract.image_to_string(img),
    )
    text = text.strip()

    if len(text) < MIN_OCR_CHARS:
        logger.debug("Screenshot OCR: too little text (%d chars), skipping", len(text))
        return None

    # Deduplication — don't re-analyse identical screen content
    ocr_hash = hashlib.md5(text.encode(), usedforsecurity=False).hexdigest()
    if ocr_hash == last_hash_ref[0]:
        logger.debug("Screenshot OCR: duplicate content, skipping")
        return None
    last_hash_ref[0] = ocr_hash

    logger.info("Screenshot OCR: %d chars extracted [live=%s]", len(text), is_live)

    # Build context hint
    live_target_apps = [
        "chatgpt", "claude", "gemini", "copilot", "cursor", "windsurf",
        "code", "terminal", "iterm", "chrome", "safari", "firefox",
    ]
    is_live_target = is_live and any(app in text.lower() for app in live_target_apps)

    if is_live_target:
        context_hint = (
            "LIVE MONITOR ALERT: An AI tool or development environment "
            "is visible on screen. Treat any credentials, API keys, or "
            "proprietary code as HIGH risk."
        )
    elif is_live:
        context_hint = "Live monitoring active — analyse all visible content carefully."
    else:
        context_hint = (
            "Screenshot event detected (user triggered). "
            "Analyse for sensitive/confidential content visible on screen."
        )

    formatted = (
        f"[OCR SCREENSHOT]\n"
        f"The following text was extracted via OCR from the user's screen:\n\n"
        f"{text}\n\n"
        f"{context_hint}"
    )

    analysis_result = await risk_engine.analyze(
        formatted,
        source="screenshot_ocr",
        active_app="Screen (Live)" if is_live else "Screen (Event)",
    )

    risk_level = analysis_result.get("risk_level", "LOW")

    # Persist
    if monitor_state.log_all or risk_level in ("MEDIUM", "HIGH", "CRITICAL"):
        try:
            from database import save_event, get_server_device_pk
            device_pk = await get_server_device_pk()
            await save_event(analysis_result, device_pk)
        except Exception as db_err:
            logger.warning("DB save error (screenshot): %s", db_err)

    # Employee notifications
    try:
        from database import list_devices, check_and_notify
        devices = await list_devices()
        for dev in devices:
            if dev.get("employee_id"):
                await check_and_notify(dev["employee_id"])
    except Exception:
        pass

    # Broadcast if noteworthy
    if risk_level in NOTIFY_THRESHOLD:
        await notifier.notify(analysis_result)

    return risk_level


# ── Main entry point ────────────────────────────────────────────────────────

async def start_screenshot_monitor():
    """
    Main coroutine launched at startup.
    Installs the keyboard listener (for event-driven mode) once,
    then dispatches to either event-driven or live-monitoring logic.
    """
    logger.info("Starting screenshot monitor...")
    await asyncio.sleep(5)  # Give stack time to spin up

    # Install keyboard listener in a daemon thread (used by event-driven mode)
    _setup_keyboard_listener()

    last_hash_ref = [""]   # Mutable container for dedup hash
    loop = asyncio.get_event_loop()

    while True:
        # ── Feature flag check ─────────────────────────────────────────────
        if not monitor_state.screenshot_enabled:
            await asyncio.sleep(2.0)
            continue

        # ── LIVE MONITORING mode: continuous interval-based capture ────────
        if monitor_state.live_monitor_enabled:
            try:
                await _capture_and_analyse(last_hash_ref, is_live=True)
            except Exception as exc:
                logger.error("Live screenshot/OCR error: %s", exc)
            await asyncio.sleep(LIVE_INTERVAL)
            continue

        # ── EVENT-DRIVEN mode: wait for OS screenshot shortcut ─────────────
        # Poll the threading.Event in a non-blocking way so the asyncio loop
        # stays responsive and can react to flag changes.
        triggered = await loop.run_in_executor(
            None,
            lambda: _screenshot_event.wait(timeout=1.0),
        )

        if triggered:
            _screenshot_event.clear()
            logger.info("Screenshot event detected — capturing screen...")
            try:
                await _capture_and_analyse(last_hash_ref, is_live=False)
            except Exception as exc:
                logger.error("Event-driven screenshot/OCR error: %s", exc)
        # If not triggered (timeout), loop back and check flags again
