"""
MonitoringState — singleton that holds real-time feature flags for all monitors.

All services import `monitor_state` and check flags before doing work.
The REST API in main.py reads/writes this object.
"""
import logging
from typing import List

logger = logging.getLogger(__name__)

# ── Predefined app & website lists ────────────────────────────────────────────

DEFAULT_MONITORED_APPS: List[str] = [
    "Claude", "ChatGPT", "Gemini", "Copilot",
    "Cursor", "VS Code", "Windsurf", "Zed",
    "Antigravity", "Codex",
    "Terminal", "iTerm2", "Warp",
    "PyCharm", "IntelliJ IDEA", "WebStorm",
    "Slack", "Notion", "Discord",
    "Postman", "Insomnia",
]

DEFAULT_MONITORED_WEBSITES: List[str] = [
    "chatgpt.com", "claude.ai", "gemini.google.com",
    "copilot.microsoft.com", "bard.google.com",
    "perplexity.ai", "poe.com", "you.com",
    "phind.com", "huggingface.co", "cohere.com",
    "anthropic.com", "openai.com", "mistral.ai",
    "groq.com", "together.ai", "replicate.com",
]


class MonitoringState:
    """Thread-safe enough for asyncio single-threaded use."""

    def __init__(self):
        # ── Monitor toggles ────────────────────────────────────────────────
        self.clipboard_enabled: bool = True
        """Event-driven clipboard monitoring — analyses clipboard on every copy event."""

        self.screenshot_enabled: bool = True
        """Event-driven screenshot monitoring — analyses screenshot when the user takes one
        (Cmd+Shift+4 on macOS, Print Screen on Windows/Linux)."""

        self.live_monitor_enabled: bool = False
        """
        Live monitoring mode — continuously takes screenshots every 5 s.
        High resource usage. Requires screenshot_enabled to be True.
        Disabled by default.
        """

        self.file_upload_detection_enabled: bool = False
        """
        File upload detection — monitors file uploads to AI websites.
        Only applies to websites in monitored_websites list.
        Disabled by default.
        """

        # ── App / website selection ────────────────────────────────────────
        self.monitored_apps: List[str] = list(DEFAULT_MONITORED_APPS)
        """
        Apps to monitor. All enabled by default.
        Deselected apps are whitelisted (events from them are suppressed).
        """

        self.monitored_websites: List[str] = list(DEFAULT_MONITORED_WEBSITES)
        """
        Websites to monitor. All enabled by default.
        Deselected sites are whitelisted.
        """

        # ── Behaviour flags ───────────────────────────────────────────────
        self.block_high_critical: bool = True
        """Redact clipboard for HIGH/CRITICAL risk events."""

        self.warn_medium: bool = True
        """Partially redact clipboard for MEDIUM risk events."""

        self.auto_sanitize: bool = True
        """Apply regex sanitization before storing/broadcasting."""

        self.log_all: bool = True
        """Persist every event to the database (not just high-risk)."""

        self.allow_low: bool = True
        """Silently pass LOW-risk events without any clipboard action."""

    def to_dict(self) -> dict:
        return {
            "clipboard_enabled": self.clipboard_enabled,
            "screenshot_enabled": self.screenshot_enabled,
            "live_monitor_enabled": self.live_monitor_enabled,
            "file_upload_detection_enabled": self.file_upload_detection_enabled,
            "monitored_apps": self.monitored_apps,
            "monitored_websites": self.monitored_websites,
            "block_high_critical": self.block_high_critical,
            "warn_medium": self.warn_medium,
            "auto_sanitize": self.auto_sanitize,
            "log_all": self.log_all,
            "allow_low": self.allow_low,
        }

    def update(self, data: dict) -> None:
        """Update any subset of flags from a dict payload."""
        bool_fields = [
            "clipboard_enabled", "screenshot_enabled", "live_monitor_enabled",
            "file_upload_detection_enabled", "block_high_critical",
            "warn_medium", "auto_sanitize", "log_all", "allow_low",
        ]
        list_fields = ["monitored_apps", "monitored_websites"]

        for field in bool_fields:
            if field in data:
                val = data[field]
                if isinstance(val, bool):
                    setattr(self, field, val)
                    logger.info("Policy flag updated: %s = %s", field, val)

        for field in list_fields:
            if field in data:
                val = data[field]
                if isinstance(val, list):
                    setattr(self, field, val)
                    logger.info("Policy list updated: %s (%d items)", field, len(val))


# Global singleton — imported everywhere
monitor_state = MonitoringState()
