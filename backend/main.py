
import json
import os
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

# Load environment variables from backend/.env
load_dotenv()

APP_NAME = "BrandGuard AI Review API"
MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
API_KEY = os.getenv("GEMINI_API_KEY")

# --------------------------------------------------
# FastAPI application
# --------------------------------------------------

app = FastAPI(
    title=APP_NAME,
    version="2.0",
    description="AI-powered brand content review API",
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
        "api_key_configured": bool(API_KEY),
    }


# --------------------------------------------------
# Gemini AI content review
# --------------------------------------------------

@app.post("/api/review", response_model=ReviewResponse)
def review_content(request: ReviewRequest):

    if not API_KEY:
        raise HTTPException(
            status_code=503,
            detail=(
                "GEMINI_API_KEY is not configured. "
                "Add it to backend/.env and restart the API."
            ),
        )

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

    try:
        client = genai.Client(api_key=API_KEY)

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
                result = response.parsed
            else:
                result = GeminiReviewOutput.model_validate(
                    response.parsed
                )
        else:
            result = GeminiReviewOutput.model_validate_json(
                response.text or "{}"
            )

    except Exception as exc:
        # Do not expose API keys or raw provider error details.
        print(
            f"Gemini review error: {exc.__class__.__name__}"
        )

        raise HTTPException(
            status_code=502,
            detail=(
                f"Gemini review failed ({exc.__class__.__name__}). "
                "Check the backend API key, model name, SDK, "
                "and API quota."
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
