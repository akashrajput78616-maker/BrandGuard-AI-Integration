import json
import logging
import os
import threading
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from rag.chunker import DocumentChunk
from rag.embedder import GeminiEmbedder
from rag.vector_store import get_vector_store
from rag.ingestion import IngestionManager
from rag.review_engine import RAGReviewEngine, GroundedFinding
from rag.seed_data import seed_guidelines_if_empty

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

# Initialize RAG Pipeline components
vector_store = get_vector_store()
embedder = GeminiEmbedder(key_agent=gemini_agent, model="text-embedding-004")
ingestion_manager = IngestionManager(vector_store=vector_store, embedder=embedder)
rag_review_engine = RAGReviewEngine(
    embedder=embedder,
    vector_store=vector_store,
    ingestion_manager=ingestion_manager,
    key_agent=gemini_agent,
    model=MODEL,
)


# --------------------------------------------------
# FastAPI application
# --------------------------------------------------

app = FastAPI(
    title=APP_NAME,
    version="3.0",
    description="Intelligent Brand Governance Platform with RAG, Multi-Modal Vision, and Enterprise Collaboration",
)

origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in origins else origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    """Seed initial enterprise guidelines for default tenant on boot if empty."""
    try:
        seed_guidelines_if_empty(ingestion_manager, tenant_id="default-tenant")
    except Exception as e:
        logger.warning(f"Could not run initial guideline seed: {e}")


# --------------------------------------------------
# Request and response models
# --------------------------------------------------

class ReviewRequest(BaseModel):
    brand_name: str = Field(default="", max_length=200)
    content: str = Field(min_length=1, max_length=20000)
    tenant_id: str = Field(default="default-tenant")


class ReviewResponse(BaseModel):
    brand_name: str
    model: str
    original_content: str
    findings: list[GroundedFinding]
    grounding_chunks_used: int = 0
    retrieved_sources: list[dict] = Field(default_factory=list)
    disclaimer: str


# --------------------------------------------------
# Health check
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "BrandGuard AI API (Round 3) is running",
        "docs": "/docs",
        "version": "3.0",
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
        "rag_vector_chunks_indexed": vector_store.get_chunk_count(),
        "rag_documents_count": len(ingestion_manager.list_documents("all")),
    }


# --------------------------------------------------
# RAG Document Ingestion & Knowledge Base Endpoints
# --------------------------------------------------

@app.get("/api/documents")
def list_documents(tenant_id: str = "default-tenant"):
    """Lists all ingested brand guideline documents for the tenant."""
    docs = ingestion_manager.list_documents(tenant_id)
    return {"documents": [d.model_dump() for d in docs]}


@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    tenant_id: str = Form("default-tenant"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Uploads a PDF, DOCX, or TXT brand guideline document.
    Dispatches asynchronous parsing, chunking, embedding, and vector indexing.
    """
    contents = await file.read()
    if len(contents) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 25MB enterprise limit")

    doc = ingestion_manager.register_document(
        filename=file.filename,
        file_bytes=contents,
        tenant_id=tenant_id,
    )

    # Process in background task
    background_tasks.add_task(ingestion_manager.process_document, doc.id)

    return {
        "message": "Document uploaded successfully and queued for vector indexing",
        "document": doc.model_dump(),
    }


@app.get("/api/documents/{document_id}")
def get_document_details(document_id: str, tenant_id: str = "default-tenant"):
    """Fetches status and details of a single guideline document."""
    doc = ingestion_manager.get_document(document_id, tenant_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"document": doc.model_dump()}


@app.get("/api/documents/{document_id}/chunks")
def get_document_chunks(document_id: str, tenant_id: str = "default-tenant"):
    """Returns parsed chunk snippets and heading metadata for a document."""
    chunks = vector_store.get_chunks_by_document(document_id, tenant_id)
    return {"chunks": [c.model_dump() for c in chunks]}


@app.delete("/api/documents/{document_id}")
def delete_document(document_id: str, tenant_id: str = "default-tenant"):
    """Deletes document and removes all corresponding vector embeddings."""
    success = ingestion_manager.delete_document(document_id, tenant_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found or delete failed")
    return {"message": "Document and vector embeddings deleted successfully"}


@app.post("/api/documents/{document_id}/reindex")
def reindex_document(
    document_id: str,
    tenant_id: str = "default-tenant",
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Re-triggers extraction, sliding-window chunking, and embedding."""
    doc = ingestion_manager.get_document(document_id, tenant_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    background_tasks.add_task(ingestion_manager.reindex_document, document_id, tenant_id)
    return {"message": "Document reindexing queued", "document_id": document_id}


@app.get("/api/rag/search")
def test_rag_similarity_search(
    query: str,
    tenant_id: str = "default-tenant",
    top_k: int = 4,
):
    """Semantic vector search test endpoint for inspecting grounding retrieval."""
    if not query.strip():
        return {"query": query, "results": []}

    q_vec = embedder.embed_query(query)
    results = vector_store.similarity_search(
        query_embedding=q_vec,
        tenant_id=tenant_id,
        top_k=top_k,
        score_threshold=0.35,
    )

    formatted = []
    for chunk, score in results:
        doc = ingestion_manager.get_document(chunk.document_id, tenant_id)
        formatted.append({
            "chunk_id": chunk.id,
            "document_name": doc.filename if doc else "Brand Guideline",
            "heading": chunk.section_heading,
            "page": chunk.page_number or 1,
            "score": round(score, 3),
            "content": chunk.content,
        })
    return {"query": query, "results": formatted}


# --------------------------------------------------
# RAG-Grounded Content Review
# --------------------------------------------------

@app.post("/api/review", response_model=ReviewResponse)
def review_content(request: ReviewRequest):
    """
    RAG-grounded content review.
    Embeds input content, retrieves top-k guideline chunks filtered by tenant,
    and returns findings citing source document, section/page, and exact snippet.
    Abstains when no verified rule exists.
    """
    try:
        response = rag_review_engine.review(
            content=request.content,
            brand_name=request.brand_name or "Acme CloudSync",
            tenant_id=request.tenant_id or "default-tenant",
        )
        return ReviewResponse(
            brand_name=response.brand_name,
            model=response.model,
            original_content=response.original_content,
            findings=response.findings,
            grounding_chunks_used=response.grounding_chunks_used,
            retrieved_sources=response.retrieved_sources,
            disclaimer=response.disclaimer,
        )
    except Exception as exc:
        logger.error(f"RAG review failed: {exc}", exc_info=True)
        raise HTTPException(
            status_code=502,
            detail=f"Grounded review processing error ({exc.__class__.__name__}): {exc}",
        )

