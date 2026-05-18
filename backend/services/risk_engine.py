import re
import uuid
import time
import logging
from services.ai_engine import ai_engine
from services.sanitizer import sanitizer

logger = logging.getLogger(__name__)

# Risk levels ordered by severity (index = severity rank)
RISK_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

# Default severity per risk level when AI doesn't provide one
DEFAULT_SEVERITY = {"LOW": 2, "MEDIUM": 5, "HIGH": 7, "CRITICAL": 9}


def _higher_risk(a: str, b: str) -> str:
    """Return whichever risk level is higher."""
    try:
        return a if RISK_ORDER.index(a) >= RISK_ORDER.index(b) else b
    except ValueError:
        return b if b in RISK_ORDER else a


def _normalize_risk(level: str) -> str:
    """Map any non-standard level (ERROR, UNKNOWN, etc.) to a valid level."""
    level = str(level).upper()
    if level in RISK_ORDER:
        return level
    # Model returned garbage — default to LOW so we don't block everything
    logger.warning("Non-standard risk level '%s' normalised to LOW", level)
    return "LOW"


class RiskEngine:
    def __init__(self):
        pass

    def quick_scan(self, text: str, active_app: str = "Unknown") -> dict | None:
        """Stage 1: fast regex scan. Returns a result dict or None if clean."""
        detected_categories = []

        for category, pattern in sanitizer.patterns.items():
            if re.search(pattern, text):
                detected_categories.append(category)

        if not detected_categories:
            return None

        # Elevate risk if the active app can exfiltrate data externally
        risky_apps = [
            "Chrome", "Safari", "Firefox", "Edge", "Arc",
            "Mail", "Outlook", "ChatGPT", "Slack", "Discord", "Telegram",
        ]
        is_risky_context = any(
            app.lower() in active_app.lower() for app in risky_apps
        )
        final_risk = "HIGH" if is_risky_context else "MEDIUM"
        severity = DEFAULT_SEVERITY[final_risk]

        return {
            "risk_level": final_risk,
            "severity": severity,
            "category": ", ".join(detected_categories),
            "reason": (
                f"Regex matched {', '.join(detected_categories)} "
                f"while active app is '{active_app}'."
            ),
            "confidence": 0.95,
        }

    async def analyze(
        self, text: str, source: str = "clipboard", active_app: str = "Unknown"
    ) -> dict:
        """Full pipeline: regex → sanitize → AI agent → merge → event payload."""

        # ── Stage 1: Quick regex scan ──────────────────────────────────────
        quick_result = self.quick_scan(text, active_app)

        # ── Stage 2: Sanitize for display ─────────────────────────────────
        # Will be overridden by smarter redaction once final risk is known
        sanitized_content = sanitizer.redact(text)

        # ── Stage 3: AI Agent (runs after regex) ──────────────────────────
        ai_result: dict = {
            "risk_level": "LOW",
            "severity": 1,
            "confidence": 1.0,
            "category": "SAFE",
            "reason": "Text too short for meaningful analysis.",
            "recommended_action": "No action required.",
        }
        if len(text) > 10:
            ai_result = await ai_engine.analyze_text(text, source, active_app)

        # ── Stage 4: Normalise AI output ──────────────────────────────────
        ai_risk = _normalize_risk(ai_result.get("risk_level", "LOW"))
        ai_result["risk_level"] = ai_risk

        ai_severity = ai_result.get("severity", DEFAULT_SEVERITY.get(ai_risk, 2))
        try:
            ai_severity = max(1, min(10, int(ai_severity)))
        except (TypeError, ValueError):
            ai_severity = DEFAULT_SEVERITY.get(ai_risk, 2)
        ai_result["severity"] = ai_severity

        # ── Stage 5: Merge — take highest risk ────────────────────────────
        if quick_result and _higher_risk(quick_result["risk_level"], ai_risk) == quick_result["risk_level"]:
            final_risk = quick_result["risk_level"]
            final_severity = quick_result.get("severity", DEFAULT_SEVERITY[final_risk])
            final_category = quick_result["category"]
            final_reason = quick_result["reason"]
            final_confidence = quick_result["confidence"]
            final_action = ai_result.get("recommended_action", "Review flagged content.")
        else:
            final_risk = ai_risk
            final_severity = ai_severity
            final_category = ai_result.get("category", "UNKNOWN")
            final_reason = ai_result.get("reason", "No reason provided.")
            final_confidence = ai_result.get("confidence", 0.0)
            final_action = ai_result.get("recommended_action", "Review required.")

        # ── Stage 6: Smart redaction based on final risk ───────────────────
        if final_risk in ("HIGH", "CRITICAL"):
            # Full redaction — all sensitive patterns replaced
            sanitized_content = sanitizer.redact(text)
        elif final_risk == "MEDIUM":
            # Partial redaction — mask middle of secrets, preserve context
            sanitized_content = sanitizer.partial_redact(text)
        else:
            # LOW — no redaction needed
            sanitized_content = text

        return {
            "id": str(uuid.uuid4()),
            "timestamp": time.time(),
            "source": source,
            "original_content": text,
            "original_content_length": len(text),
            "sanitized_content": sanitized_content,
            "risk_level": final_risk,
            "severity": final_severity,
            "confidence": final_confidence,
            "category": final_category,
            "reason": final_reason,
            "recommended_action": final_action,
        }


risk_engine = RiskEngine()
