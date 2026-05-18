import asyncio
import logging
import pyperclip
from services.risk_engine import risk_engine
from services.sanitizer import sanitizer
from services.window_service import get_active_window
from services.monitor_state import monitor_state
from api.websocket import notifier

logger = logging.getLogger(__name__)


async def start_clipboard_monitor():
    logger.info("Starting clipboard monitor...")
    last_clipboard = ""

    while True:
        try:
            # ── Feature flag check ─────────────────────────────────────────
            if not monitor_state.clipboard_enabled:
                await asyncio.sleep(1.0)
                continue

            current_clipboard = pyperclip.paste()

            if current_clipboard != last_clipboard and current_clipboard.strip():
                last_clipboard = current_clipboard
                active_app = get_active_window()
                logger.info(
                    "Clipboard change: %d chars [App: %s]",
                    len(current_clipboard), active_app,
                )

                # ── Analyse ───────────────────────────────────────────────
                analysis_result = await risk_engine.analyze(
                    current_clipboard,
                    source="clipboard",
                    active_app=active_app,
                )

                # ── Persist (if log_all is on, or event is medium+) ───────
                risk_level = analysis_result.get("risk_level", "LOW")
                if monitor_state.log_all or risk_level in ("MEDIUM", "HIGH", "CRITICAL"):
                    try:
                        from database import save_event, get_server_device_pk
                        device_pk = await get_server_device_pk()
                        await save_event(analysis_result, device_pk)
                    except Exception as db_err:
                        logger.warning("DB save error: %s", db_err)

                # ── Broadcast ─────────────────────────────────────────────
                await notifier.notify(analysis_result)

                # ── Employee notifications ────────────────────────────────
                try:
                    from database import list_devices, check_and_notify
                    devices = await list_devices()
                    for dev in devices:
                        if dev.get("employee_id"):
                            await check_and_notify(dev["employee_id"])
                except Exception:
                    pass

                # ── Smart Clipboard Redaction ─────────────────────────────
                if risk_level in ("HIGH", "CRITICAL") and monitor_state.block_high_critical:
                    # Full redaction — replace clipboard with a clear warning
                    redacted = analysis_result.get(
                        "sanitized_content",
                        sanitizer.redact(current_clipboard),
                    )
                    logger.warning(
                        "FULL REDACTION [%s] — clipboard wiped. Category: %s",
                        risk_level,
                        analysis_result.get("category", "unknown"),
                    )
                    pyperclip.copy(
                        f"[⚠ SENTINEL AI — REDACTED | {risk_level} RISK | "
                        f"{analysis_result.get('category', 'SENSITIVE_DATA')} | "
                        f"{analysis_result.get('reason', 'Sensitive content detected.')}]"
                    )
                    last_clipboard = pyperclip.paste()

                elif risk_level == "MEDIUM" and monitor_state.warn_medium and monitor_state.auto_sanitize:
                    # Partial redaction — mask secrets, keep context readable
                    partial = analysis_result.get(
                        "sanitized_content",
                        sanitizer.partial_redact(current_clipboard),
                    )
                    if partial != current_clipboard:
                        logger.info(
                            "PARTIAL REDACTION [MEDIUM] — clipboard masked. Category: %s",
                            analysis_result.get("category", "unknown"),
                        )
                        pyperclip.copy(partial)
                        last_clipboard = pyperclip.paste()

                # LOW → clipboard untouched

        except Exception as e:
            logger.error("Clipboard monitor error: %s", e)

        await asyncio.sleep(1.0)
