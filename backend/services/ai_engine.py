import os
import re
import json
import asyncio
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Maximum text length to send to the model — prevents KV cache overflow
MAX_PROMPT_CHARS = 1500

# Concise system prompt for the DLP agent
SYSTEM_PROMPT = """You are Sentinel AI Agent — a local, privacy-first Data Loss Prevention (DLP) analyst.
You will be given text from a user's clipboard or screen OCR, along with the source application.
Your job is to classify the risk and explain it concisely.

CLASSIFICATION RULES:
1. Public/generic commands (npm run dev, git status, ls, cd, etc.) → LOW, severity 1-2
2. Internal source code copied in a local IDE (VS Code, Terminal, Xcode) → MEDIUM, severity 4-5
3. Credentials/API keys/passwords in any context → HIGH, severity 7-8
4. Credentials/API keys/PII in a browser, Slack, Discord, Email, or external app → CRITICAL, severity 9-10
5. For OCR/screenshot sources: treat visible internal architecture or credentials as MEDIUM minimum
6. PII (email addresses, phone numbers, SSNs) → MEDIUM-HIGH depending on context
7. severity 1-3 = LOW, 4-6 = MEDIUM, 7-8 = HIGH, 9-10 = CRITICAL (must be consistent)

RESPONSE FORMAT — return ONLY this JSON, nothing else, no markdown:
{
  "risk_level": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "severity": <integer 1-10>,
  "confidence": <float 0.0-1.0>,
  "category": "<e.g. SAFE_COMMAND | AWS_CREDENTIALS | SOURCE_CODE | PII | DATABASE_CREDS | INTERNAL_DATA>",
  "reason": "<one concise sentence, max 20 words, explaining the classification>",
  "recommended_action": "<specific action the user should take>"
}"""


class AIEngine:
    def __init__(self):
        self.model_path = os.environ.get(
            "MODEL_PATH",
            # "../models/Qwen2.5-7B-Instruct-bnb-4bit.gguf"
            "../models/qwen2.5-3b-instruct-q4_k_m.gguf"
        )
        self.llm = None
        self.is_ready = False
        self._load_lock = asyncio.Lock()
        self._crashed = False

        if os.path.exists(self.model_path):
            self._try_load_model()
        else:
            logger.warning(
                "Model not found at %s. AI analysis disabled — regex-only mode active.",
                self.model_path
            )

    def _try_load_model(self):
        """Load the GGUF model. Catches any llama.cpp error gracefully."""
        try:
            from llama_cpp import Llama
            self.llm = Llama(
                model_path=self.model_path,
                n_ctx=2048,       # Reduced from 4096 — prevents KV cache GGML_ASSERT crash
                n_batch=128,      # Smaller batch → lower peak memory → fewer Metal OOM crashes
                n_threads=4,
                n_gpu_layers=-1,  # Metal GPU offload on Apple Silicon
                verbose=False,    # Suppress ggml metal compile spam
            )
            self.is_ready = True
            self._crashed = False
            logger.info("AI Engine ready: %s", self.model_path)
        except Exception as e:
            logger.error("Error loading model: %s", e)
            self.llm = None
            self.is_ready = False

    def _build_prompt(self, text: str, source: str, active_app: str) -> str:
        """Build the Qwen2.5 instruct-format prompt for the DLP agent."""
        # Truncate to prevent KV cache overflow
        truncated = text[:MAX_PROMPT_CHARS]
        if len(text) > MAX_PROMPT_CHARS:
            truncated += f"\n[... truncated, original length: {len(text)} chars]"

        source_label = "screenshot (OCR-extracted text)" if "screenshot" in source else "clipboard"

        return (
            f"<|im_start|>system\n{SYSTEM_PROMPT}<|im_end|>\n"
            f"<|im_start|>user\n"
            f"Source: {source_label}\n"
            f"Active application: {active_app}\n\n"
            f"Content to analyze:\n{truncated}"
            f"<|im_end|>\n"
            f"<|im_start|>assistant\n"
        )

    def _parse_response(self, raw: str) -> Optional[dict]:
        """Extract and validate JSON from model output robustly."""
        text = raw.strip()

        # Strip markdown code fences (```json ... ``` or ``` ... ```)
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)

        # Find the first { ... } block
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            text = match.group(0)

        try:
            result = json.loads(text)
        except json.JSONDecodeError:
            logger.warning("Failed to parse LLM JSON output: %r", raw[:200])
            return None

        # Validate and normalise required fields
        valid_levels = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
        risk = str(result.get("risk_level", "")).upper()
        if risk not in valid_levels:
            # Try to infer from severity
            sev = int(result.get("severity", 0))
            if sev >= 9:
                risk = "CRITICAL"
            elif sev >= 7:
                risk = "HIGH"
            elif sev >= 4:
                risk = "MEDIUM"
            else:
                risk = "LOW"

        result["risk_level"] = risk

        # Clamp severity to 1-10
        sev = result.get("severity", 0)
        try:
            sev = max(1, min(10, int(sev)))
        except (TypeError, ValueError):
            # Infer from risk level if severity missing/invalid
            sev = {"LOW": 2, "MEDIUM": 5, "HIGH": 7, "CRITICAL": 9}.get(risk, 2)
        result["severity"] = sev

        # Clamp confidence
        conf = result.get("confidence", 0.7)
        try:
            conf = max(0.0, min(1.0, float(conf)))
        except (TypeError, ValueError):
            conf = 0.7
        result["confidence"] = conf

        return result

    async def analyze_text(
        self, text: str, source: str = "clipboard", active_app: str = "Unknown"
    ) -> dict:
        """Run the DLP agent. Returns a structured analysis dict. Never raises."""

        # --- No model loaded ---
        if not self.is_ready or not self.llm:
            reason = "Model crashed during previous inference" if self._crashed else "AI model not loaded"
            logger.warning("AI Engine skipped: %s", reason)
            return {
                "risk_level": "LOW",
                "severity": 1,
                "confidence": 0.0,
                "category": "no_model",
                "reason": reason,
                "recommended_action": "Regex-only scan applied. Check model path.",
            }

        prompt = self._build_prompt(text, source, active_app)

        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.llm(
                    prompt,
                    max_tokens=300,
                    stop=["<|im_end|>"],
                    temperature=0.05,   # Near-deterministic for structured output
                    repeat_penalty=1.1,
                ),
            )

            raw_text = response["choices"][0]["text"].strip()
            result = self._parse_response(raw_text)

            if result:
                return result

            # Parsing failed — return safe fallback (don't crash the pipeline)
            return {
                "risk_level": "MEDIUM",
                "severity": 4,
                "confidence": 0.3,
                "category": "parse_error",
                "reason": "AI response was not valid JSON; manual review recommended.",
                "recommended_action": "Review the flagged content manually.",
            }

        except Exception as e:
            # Mark as crashed so subsequent calls skip the model instead of hanging
            self._crashed = True
            self.is_ready = False
            logger.error("AI Engine inference error (model marked crashed): %s", e)
            return {
                "risk_level": "LOW",
                "severity": 1,
                "confidence": 0.0,
                "category": "model_crash",
                "reason": f"AI inference failed: {str(e)[:80]}",
                "recommended_action": "Backend model crashed. Regex scan only. Restart service.",
            }


ai_engine = AIEngine()
