import re

class Sanitizer:
    def __init__(self):
        # Regex patterns for instant detection & redaction
        self.patterns = {
            "AWS_ACCESS_KEY_ID":     r"(?i)(AKIA[0-9A-Z]{16})",
            "AWS_SECRET_ACCESS_KEY": r"(?i)([0-9a-zA-Z/+]{40})",
            "EMAIL":                 r"([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)",
            "CREDIT_CARD":           r"(\b(?:\d[ -]*?){13,16}\b)",
            "PASSWORD_FIELD":        r"(?i)(password\s*[:=]\s*\S+)",
            "API_KEY_GENERIC":       r"(?i)(api[_-]?key\s*[:=]\s*\S+)",
            "JWT_TOKEN":             r"(eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)",
            "PHONE_NUMBER":          r"(\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b)",
            "IP_WITH_PORT":          r"(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{2,5}\b)",
            "DB_CONN_STRING":        r"(?i)((?:postgres|mysql|mongodb|redis|mssql)://[^\s]+)",
        }

    # ── Full redaction (HIGH / CRITICAL) ─────────────────────────────────────
    def redact(self, text: str) -> str:
        """Replace every sensitive match entirely with [TYPE_REDACTED]."""
        result = text
        for category, pattern in self.patterns.items():
            result = re.sub(pattern, f"[{category}_REDACTED]", result)
        return result

    # ── Partial redaction (MEDIUM) ────────────────────────────────────────────
    def partial_redact(self, text: str) -> str:
        """Mask the middle of each sensitive match — preserves enough context
        so the user understands what was there while hiding the secret itself.

        Examples:
          AKIAIOSFODNN7EXAMPLE  →  AKIA****MPLE
          user@company.com      →  us**@company.com
          postgres://admin:s3cr3t@host/db  →  postgres://admin:***@host/db
        """
        result = text
        for category, pattern in self.patterns.items():
            result = re.sub(
                pattern,
                lambda m: self._mask(m.group(0), category),
                result,
            )
        return result

    # ── Internal masking helpers ──────────────────────────────────────────────
    @staticmethod
    def _mask(value: str, category: str) -> str:
        """Produce a partially-masked version of value appropriate to its category."""
        if category == "EMAIL":
            # user@domain.com → u***@domain.com
            at = value.find("@")
            if at > 1:
                local = value[:at]
                domain = value[at:]
                masked_local = local[0] + "***"
                return f"{masked_local}{domain}"
            return "***@***"

        if category in ("DB_CONN_STRING", "PASSWORD_FIELD", "API_KEY_GENERIC"):
            # Hide everything after the separator (: or =)
            for sep in ("://", "::", ":", "="):
                idx = value.find(sep)
                if idx != -1:
                    visible = value[: idx + len(sep)]
                    return f"{visible}[***REDACTED***]"
            return value[:4] + "[***REDACTED***]"

        if category == "JWT_TOKEN":
            # Show header only — eyJhbG...
            parts = value.split(".")
            return f"{parts[0]}.[***].[***]"

        # Generic: show first 4 + *** + last 2
        v = value.strip()
        if len(v) <= 8:
            return "****"
        return f"{v[:4]}***{v[-2:]}"


sanitizer = Sanitizer()
