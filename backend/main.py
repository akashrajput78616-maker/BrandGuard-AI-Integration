import json
import logging
import os
import threading
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

# Load environment variables from backend/.env
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("brandguard.agent")

APP_NAME = "BrandGuard AI Review API"
MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


# --------------------------------------------------
# Multi-Key Pool & Failover Agent
# --------------------------------------------------

def parse_gemini_keys() -> list[str]:
    """
    Extract and deduplicate all configured Gemini API keys from environment variables.
    Supports:
      - GEMINI_API_KEYS (comma-separated list: "key1,key2,key3")
      - GEMINI_API_KEY (single key or comma-separated list)
      - GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3, etc.
    """
    keys: list[str] = []

    # 1. Comma-separated list in GEMINI_API_KEYS
    env_keys = os.getenv("GEMINI_API_KEYS", "")
    if env_keys:
        keys.extend([k.strip() for k in env_keys.split(",") if k.strip()])

    # 2. Key(s) in GEMINI_API_KEY
    single_key = os.getenv("GEMINI_API_KEY", "")
    if single_key:
        keys.extend([k.strip() for k in single_key.split(",") if k.strip()])

    # 3. Numbered keys: GEMINI_API_KEY_1 to GEMINI_API_KEY_20
    for i in range(1, 21):
        numbered = os.getenv(f"GEMINI_API_KEY_{i}", "").strip()
        if numbered:
            keys.append(numbered)

    # Deduplicate while preserving priority order
    seen = set()
    deduped = []
    for k in keys:
        if k not in seen:
            seen.add(k)
            deduped.append(k)
    return deduped


class GeminiKeyAgent:
    """
    Intelligent agent that manages a pool of Gemini API keys.
    Automatically rotates to the next API key when token limits,
    quotas, or rate limits (HTTP 429 / RESOURCE_EXHAUSTED) are hit.
    """

    def __init__(self):
        self.lock = threading.Lock()
        self.keys = parse_gemini_keys()
        self.active_index = 0

    def refresh_keys(self):
        with self.lock:
            self.keys = parse_gemini_keys()
            if self.active_index >= len(self.keys):
                self.active_index = 0

    @property
    def key_count(self) -> int:
        return len(self.keys)

    @staticmethod
    def mask_key(key: str) -> str:
        if not key:
            return "none"
        if len(key) <= 8:
            return "***"
        return f"...{key[-6:]}"

    def is_exhaustion_error(self, exc: Exception) -> bool:
        """Determines if the exception was caused by quota exhaustion or rate limits."""
        code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
        if code in (429, 503):
            return True

        msg = str(exc).lower()
        exhaustion_indicators = [
            "429",
            "resource_exhausted",
            "resourceexhausted",
            "quota",
            "rate limit",
            "rate_limit",
            "too many requests",
            "tokens per minute",
            "requests per minute",
            "exhausted",
            "capacity",
            "api_key_invalid",
            "expired",
        ]
        return any(ind in msg for ind in exhaustion_indicators)

    def execute_with_failover(self, call_fn):
        """
        Executes call_fn(client) using the current API key.
        If a quota/token exhaustion occurs, automatically switches to the next API key.
        """
        if not self.keys:
            raise HTTPException(
                status_code=503,
                detail=(
                    "No GEMINI_API_KEY configured. "
                    "Add GEMINI_API_KEY or GEMINI_API_KEYS to backend/.env and restart the API."
                ),
            )

        with self.lock:
            start_index = self.active_index
            total_keys = len(self.keys)

        last_error = None

        for attempt in range(total_keys):
            with self.lock:
                key_index = (start_index + attempt) % total_keys
                api_key = self.keys[key_index]
                masked = self.mask_key(api_key)

            try:
                client = genai.Client(api_key=api_key)
                result = call_fn(client)

                # Successful call: save this active key index
                with self.lock:
                    self.active_index = key_index

                return result

            except Exception as exc:
                last_error = exc
                if self.is_exhaustion_error(exc):
                    logger.warning(
                        f"[GeminiAgent] Key [{key_index + 1}/{total_keys}] ({masked}) exhausted/rate-limited: "
                        f"{exc.__class__.__name__}. Switching to next API key..."
                    )
                    continue
                else:
                    logger.error(
                        f"[GeminiAgent] Error with key [{key_index + 1}/{total_keys}] ({masked}): "
                        f"{exc.__class__.__name__}: {exc}"
                    )
                    if total_keys > 1 and attempt < total_keys - 1:
                        logger.info("Attempting backup key...")
                        continue
                    raise exc

        # All keys in pool were tried and exhausted
        logger.error(f"[GeminiAgent] All {total_keys} Gemini API keys in the pool have been exhausted.")
        raise HTTPException(
            status_code=429,
            detail=(
                f"All {total_keys} configured Gemini API keys have exhausted their quota/tokens. "
                "Please add a new API key or wait for the quota window to reset."
            ),
        )


gemini_agent = GeminiKeyAgent()


# --------------------------------------------------
# FastAPI application
# --------------------------------------------------

app = FastAPI(
    title=APP_NAME,
    version="2.0",
    description="AI-powered brand content review API with automatic multi-key failover",
)

origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# --------------------------------------------------
# Request and response models
# --------------------------------------------------

class ReviewRequest(BaseModel):
    brand_name: str = Field(
        default="",
        max_length=200,
    )
    content: str = Field(
        min_length=1,
        max_length=20000,
    )


class Finding(BaseModel):
    id: str = ""
    issue_type: str
    severity: Literal["HIGH", "MEDIUM", "LOW"]
    quote: str = ""
    explanation: str
    source_rule: str = ""
    confidence: int = Field(ge=0, le=100)
    suggested_fix: str = ""
    needs_human_review: bool = False


class GeminiReviewOutput(BaseModel):
    findings: list[Finding] = Field(default_factory=list)


class ReviewResponse(BaseModel):
    brand_name: str
    model: str
    original_content: str
    findings: list[Finding]
    disclaimer: str


# --------------------------------------------------
# Health check
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "BrandGuard AI API is running",
        "docs": "/docs",
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": APP_NAME,
        "model": MODEL,
        "api_keys_configured": gemini_agent.key_count,
        "active_key_index": (gemini_agent.active_index + 1) if gemini_agent.key_count > 0 else 0,
        "api_key_configured": gemini_agent.key_count > 0,
    }


# --------------------------------------------------
# Gemini AI content review with multi-key failover
# --------------------------------------------------

@app.post("/api/review", response_model=ReviewResponse)
def review_content(request: ReviewRequest):

    # Send the submitted brand and content to Gemini.
    user_payload = {
        "brand_name": request.brand_name,
        "content": request.content,
    }

    instructions = """
You are BrandGuard AI, an assistant that reviews marketing
and brand content for potential compliance and communication risks.

Analyze the submitted content carefully.

Look for issues such as:
1. Unsupported or exaggerated claims.
2. Absolute guarantees and misleading promises.
3. Potentially deceptive statements.
4. Missing evidence for factual or performance claims.
5. Risky health, financial, legal, or safety claims.
6. Potentially offensive or inappropriate wording.
7. Brand consistency and clarity problems.

Rules:
- Review the actual submitted text, not imaginary content.
- Do not invent brand policies, laws, or evidence.
- Do not automatically label every text as risky.
- If no meaningful issue is found, return an empty findings array.
- Only report specific, relevant potential issues.
- Use short exact quotes from the submitted content.
- Explain why each issue may matter.
- Give a practical suggested fix.
- Use HIGH, MEDIUM, or LOW severity.
- Confidence must be an integer from 0 to 100.
- If there is no verified source rule, leave source_rule empty
  and set needs_human_review to true.
- A review is an AI assessment, not a guarantee of compliance.
"""

    def call_gemini(client: genai.Client):
        response = client.models.generate_content(
            model=MODEL,
            contents=json.dumps(
                user_payload,
                ensure_ascii=False,
            ),
            config=types.GenerateContentConfig(
                system_instruction=instructions,
                response_mime_type="application/json",
                response_schema=GeminiReviewOutput,
                temperature=0.2,
            ),
        )

        # Prefer the SDK's parsed structured output.
        if response.parsed is not None:
            if isinstance(response.parsed, GeminiReviewOutput):
                return response.parsed
            else:
                return GeminiReviewOutput.model_validate(
                    response.parsed
                )
        else:
            return GeminiReviewOutput.model_validate_json(
                response.text or "{}"
            )

    try:
        result = gemini_agent.execute_with_failover(call_gemini)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Gemini review error: {exc.__class__.__name__}: {exc}")
        raise HTTPException(
            status_code=502,
            detail=(
                f"Gemini review failed ({exc.__class__.__name__}). "
                "Check backend API keys, model name, and quota."
            ),
        ) from None

    # Assign unique IDs and flag findings without a source rule.
    findings = []

    for index, item in enumerate(
        result.findings,
        start=1,
    ):
        if not item.source_rule:
            item.needs_human_review = True

        item.id = f"finding-{index}"
        findings.append(item)

    # Keep the original submitted content unchanged.
    return ReviewResponse(
        brand_name=request.brand_name,
        model=MODEL,
        original_content=request.content,
        findings=findings,
        disclaimer=(
            "AI-generated review only. Findings may be incomplete "
            "or inaccurate. Verify applicable brand policies, "
            "evidence, and legal requirements before making decisions."
        ),
    )
