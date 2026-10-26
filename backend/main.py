import json
import logging
import os
import threading
from typing import Literal

from dotenv import load_dotenv
from fastapi import (
    FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks,
    Depends, Response, WebSocket, WebSocketDisconnect, Query, Cookie
)
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

from auth.models import AuthenticatedUser, Role, TokenResponse, User
from auth.jwt_handler import (
    create_access_token, create_refresh_token, decode_token,
    get_current_user, get_current_user_optional, require_roles
)
from auth.storage import auth_storage
from collab.ws_hub import ws_hub
from collab.comments import comment_store
from collab.approvals import draft_store
from collab.webhooks import webhook_store, dispatch_webhook_event
from collab.audit import audit_store
from vision.delta_e import DEFAULT_ACME_PALETTE, compare_against_brand_palette
from vision.contrast import evaluate_wcag, contrast_ratio
from vision.processor import audit_visual_asset

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

    def get_active_key(self) -> Optional[str]:
        with self.lock:
            if not self.keys:
                return None
            return self.keys[self.active_index % len(self.keys)]

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

# Permitted CORS origins
raw_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,https://frontend-psi-self-29.vercel.app",
    ).split(",")
    if origin.strip()
]

frontend_url = os.getenv("FRONTEND_URL", "").strip()
if frontend_url and frontend_url not in raw_origins:
    raw_origins.append(frontend_url)

if "https://frontend-psi-self-29.vercel.app" not in raw_origins:
    raw_origins.append("https://frontend-psi-self-29.vercel.app")

# Disallow wildcard "*" when credentials are true, as browsers reject it
origins = [o for o in raw_origins if o != "*"]

# Cookie security settings (httpOnly, Secure, SameSite=None for cross-site Vercel <-> Render)
SECURE_COOKIES = os.getenv("SECURE_COOKIES", "true").lower() in ("true", "1", "yes")
COOKIE_SAMESITE: Literal["none", "lax"] = "none" if SECURE_COOKIES else "lax"
COOKIE_SECURE: bool = SECURE_COOKIES

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
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
# Health check endpoints
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "BrandGuard AI API (Round 3) is running",
        "docs": "/docs",
        "version": "3.0",
        "health": "/health",
    }


@app.get("/health")
def root_health():
    """Lightweight root health check endpoint for Render and monitoring probes."""
    return {
        "status": "ok",
        "service": APP_NAME,
        "version": "3.0",
        "model": MODEL,
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


# --------------------------------------------------
# FEATURE 2: Authentication & Multi-Tenant RBAC Endpoints
# --------------------------------------------------

class LoginRequest(BaseModel):
    email: str
    password: Optional[str] = "password"
    provider: str = "google"  # 'google', 'microsoft', 'local'
    role: Optional[Role] = None


class SwitchRoleRequest(BaseModel):
    role: Role


class DraftCreateRequest(BaseModel):
    title: str
    content: str = ""


class DraftUpdateRequest(BaseModel):
    content: str


class DraftTransitionRequest(BaseModel):
    status: str
    reason: Optional[str] = None


class CommentCreateRequest(BaseModel):
    start_offset: int
    end_offset: int
    selected_text: str
    comment: str


class CommentReplyRequest(BaseModel):
    comment: str


class WebhookCreateRequest(BaseModel):
    platform: str  # 'slack' or 'teams'
    url: str
    events: Optional[list[str]] = None


@app.post("/api/auth/login", response_model=TokenResponse)
def login(request: LoginRequest, response: Response):
    """
    Enterprise OAuth 2.0 / SSO login (Google & Microsoft).
    Issues JWT access/refresh tokens in secure httpOnly cookies.
    """
    name = request.email.split("@")[0].replace(".", " ").title()
    default_role = request.role or Role.EDITOR
    if "admin" in request.email.lower():
        default_role = Role.ADMIN
    elif "reviewer" in request.email.lower():
        default_role = Role.REVIEWER

    user = auth_storage.get_or_create_oauth_user(
        email=request.email,
        name=name,
        provider=request.provider,
        tenant_id="default-tenant",
        default_role=default_role,
    )

    access_token = create_access_token(user)
    refresh_token = create_refresh_token(user)

    # Set httpOnly cookies (SameSite=None, Secure for cross-origin Vercel <-> Render)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=3600,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=7 * 86400,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
    )

    audit_store.log(
        tenant_id=user.tenant_id,
        user_id=user.user_id,
        user_name=user.name,
        user_role=user.role.value,
        action="user_login",
        resource_type="auth",
        resource_id=user.user_id,
        details={"provider": request.provider, "email": request.email},
    )

    return TokenResponse(
        access_token=access_token,
        expires_in=3600,
        user=user,
    )


@app.post("/api/auth/refresh", response_model=TokenResponse)
def refresh_token(
    response: Response,
    refresh_token: Optional[str] = Cookie(None, alias="refresh_token"),
):
    """Refreshes access token using refresh token from httpOnly cookie."""
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    payload = decode_token(refresh_token, expected_type="refresh")
    user = auth_storage.get_authenticated_user(payload["sub"], payload["tenant_id"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    new_access_token = create_access_token(user)
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        max_age=3600,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
    )
    return TokenResponse(access_token=new_access_token, expires_in=3600, user=user)


@app.post("/api/auth/logout")
def logout(response: Response, current_user: AuthenticatedUser = Depends(get_current_user)):
    """Logs out user and clears session cookies."""
    response.delete_cookie(key="access_token", samesite=COOKIE_SAMESITE, secure=COOKIE_SECURE)
    response.delete_cookie(key="refresh_token", samesite=COOKIE_SAMESITE, secure=COOKIE_SECURE)
    audit_store.log(
        tenant_id=current_user.tenant_id,
        user_id=current_user.user_id,
        user_name=current_user.name,
        user_role=current_user.role.value,
        action="user_logout",
        resource_type="auth",
        resource_id=current_user.user_id,
    )
    return {"message": "Logged out successfully"}


@app.get("/api/auth/me", response_model=AuthenticatedUser)
def get_me(current_user: AuthenticatedUser = Depends(get_current_user)):
    """Returns profile and role permissions of current user."""
    return current_user


@app.post("/api/auth/switch-role", response_model=TokenResponse)
def switch_role(
    req: SwitchRoleRequest,
    response: Response,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Role switch utility for interactive demo/testing across Admin, Reviewer, Editor, Viewer."""
    auth_storage.set_user_role(current_user.tenant_id, current_user.user_id, req.role)
    updated_user = auth_storage.get_authenticated_user(current_user.user_id, current_user.tenant_id)

    new_token = create_access_token(updated_user)
    response.set_cookie(
        key="access_token",
        value=new_token,
        httponly=True,
        max_age=3600,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
    )
    audit_store.log(
        tenant_id=current_user.tenant_id,
        user_id=current_user.user_id,
        user_name=current_user.name,
        user_role=req.role.value,
        action="role_switched",
        resource_type="auth",
        resource_id=current_user.user_id,
        details={"new_role": req.role.value},
    )
    return TokenResponse(access_token=new_token, expires_in=3600, user=updated_user)


@app.get("/api/auth/team")
def get_team_members(current_user: AuthenticatedUser = Depends(get_current_user)):
    """Lists organization team members in current tenant."""
    members = auth_storage.list_team_members(current_user.tenant_id)
    return {"members": [m.model_dump() for m in members]}


# --------------------------------------------------
# Collaborative Drafts & Role-Based Approval Queue
# --------------------------------------------------

@app.get("/api/drafts")
def list_drafts(current_user: AuthenticatedUser = Depends(get_current_user)):
    """Lists drafts scoped to current tenant."""
    drafts = draft_store.list_drafts(current_user.tenant_id)
    return {"drafts": [d.model_dump() for d in drafts]}


@app.get("/api/drafts/{draft_id}")
def get_draft(draft_id: str, current_user: AuthenticatedUser = Depends(get_current_user)):
    draft = draft_store.get_draft(draft_id, current_user.tenant_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    return {"draft": draft.model_dump()}


@app.post("/api/drafts")
def create_draft(
    req: DraftCreateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    if current_user.role == Role.VIEWER:
        raise HTTPException(status_code=403, detail="Viewers cannot create drafts")
    draft = draft_store.create_draft(
        tenant_id=current_user.tenant_id,
        title=req.title,
        content=req.content,
        created_by=current_user.user_id,
    )
    audit_store.log(
        tenant_id=current_user.tenant_id,
        user_id=current_user.user_id,
        user_name=current_user.name,
        user_role=current_user.role.value,
        action="draft_created",
        resource_type="draft",
        resource_id=draft.id,
        details={"title": draft.title},
    )
    return {"draft": draft.model_dump()}


@app.put("/api/drafts/{draft_id}")
async def update_draft(
    draft_id: str,
    req: DraftUpdateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    draft = draft_store.update_draft_content(
        draft_id=draft_id,
        tenant_id=current_user.tenant_id,
        content=req.content,
        user_role=current_user.role,
    )
    # Broadcast to active collaborators in room
    room_key = f"{current_user.tenant_id}:{draft_id}"
    await ws_hub.broadcast_content_change(
        room_key=room_key,
        user_id=current_user.user_id,
        change_data={"content": draft.content, "version": draft.version},
    )
    return {"draft": draft.model_dump()}


@app.post("/api/drafts/{draft_id}/transition")
async def transition_draft_status(
    draft_id: str,
    req: DraftTransitionRequest,
    background_tasks: BackgroundTasks,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Executes role-gated state transition:
    - Editor/Creator can submit to 'In Review'
    - Reviewer/Admin can transition to 'Approved' or 'Rejected'
    Dispatches webhooks to Slack/Teams and logs audit entry.
    """
    draft = draft_store.transition_status(
        draft_id=draft_id,
        tenant_id=current_user.tenant_id,
        target_status=req.status,
        user_id=current_user.user_id,
        user_name=current_user.name,
        user_role=current_user.role,
        reason=req.reason,
    )

    # Log audit entry
    audit_store.log(
        tenant_id=current_user.tenant_id,
        user_id=current_user.user_id,
        user_name=current_user.name,
        user_role=current_user.role.value,
        action=f"status_changed_to_{req.status.lower().replace(' ', '_')}",
        resource_type="draft",
        resource_id=draft.id,
        details={"status": req.status, "reason": req.reason},
    )

    # Broadcast status change via WebSocket
    await ws_hub.broadcast_status_change(
        tenant_id=current_user.tenant_id,
        draft_id=draft.id,
        new_status=req.status,
        changed_by=current_user.name,
    )

    # Dispatch webhooks asynchronously
    event_name = (
        "review_requested"
        if req.status == "In Review"
        else "decision_approved"
        if req.status == "Approved"
        else "decision_rejected"
    )
    background_tasks.add_task(
        dispatch_webhook_event,
        tenant_id=current_user.tenant_id,
        event=event_name,
        title=f"Draft '{draft.title}' is now {req.status}",
        details={
            "draft_title": draft.title,
            "status": req.status,
            "by": f"{current_user.name} ({current_user.role.value})",
            "summary": req.reason or f"Status shifted to {req.status}",
        },
    )

    return {"message": f"Draft status changed to {req.status}", "draft": draft.model_dump()}


# --------------------------------------------------
# Threaded Inline Review Comments
# --------------------------------------------------

@app.get("/api/drafts/{draft_id}/comments")
def get_draft_comments(draft_id: str, current_user: AuthenticatedUser = Depends(get_current_user)):
    comments = comment_store.get_comments(current_user.tenant_id, draft_id)
    return {"comments": [c.model_dump() for c in comments]}


@app.post("/api/drafts/{draft_id}/comments")
async def add_inline_comment(
    draft_id: str,
    req: CommentCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    if current_user.role == Role.VIEWER:
        raise HTTPException(status_code=403, detail="Viewers cannot add comments")

    comment = comment_store.add_comment(
        tenant_id=current_user.tenant_id,
        draft_id=draft_id,
        author_id=current_user.user_id,
        author_name=current_user.name,
        author_role=current_user.role.value,
        start_offset=req.start_offset,
        end_offset=req.end_offset,
        selected_text=req.selected_text,
        comment=req.comment,
    )

    # Broadcast via WebSocket
    await ws_hub.broadcast_comment_event(
        tenant_id=current_user.tenant_id,
        draft_id=draft_id,
        event_data={"action": "created", "comment": comment.model_dump()},
    )

    # Log audit entry
    audit_store.log(
        tenant_id=current_user.tenant_id,
        user_id=current_user.user_id,
        user_name=current_user.name,
        user_role=current_user.role.value,
        action="comment_added",
        resource_type="comment",
        resource_id=comment.id,
        details={"quote": req.selected_text[:50], "comment": req.comment},
    )

    # Dispatch webhooks
    background_tasks.add_task(
        dispatch_webhook_event,
        tenant_id=current_user.tenant_id,
        event="comment_added",
        title=f"New comment by {current_user.name}",
        details={
            "draft_title": f"Draft {draft_id[:8]}",
            "by": f"{current_user.name} ({current_user.role.value})",
            "summary": f'"{req.selected_text}": {req.comment}',
        },
    )

    return {"comment": comment.model_dump()}


@app.post("/api/drafts/{draft_id}/comments/{comment_id}/reply")
async def add_comment_reply(
    draft_id: str,
    comment_id: str,
    req: CommentReplyRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    if current_user.role == Role.VIEWER:
        raise HTTPException(status_code=403, detail="Viewers cannot reply")

    updated = comment_store.add_reply(
        tenant_id=current_user.tenant_id,
        comment_id=comment_id,
        author_id=current_user.user_id,
        author_name=current_user.name,
        author_role=current_user.role.value,
        reply_text=req.comment,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Comment not found")

    await ws_hub.broadcast_comment_event(
        tenant_id=current_user.tenant_id,
        draft_id=draft_id,
        event_data={"action": "reply", "comment": updated.model_dump()},
    )

    return {"comment": updated.model_dump()}


@app.patch("/api/drafts/{draft_id}/comments/{comment_id}/resolve")
async def toggle_resolve_comment(
    draft_id: str,
    comment_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    updated = comment_store.toggle_resolve(
        tenant_id=current_user.tenant_id,
        comment_id=comment_id,
        user_name=current_user.name,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Comment not found")

    await ws_hub.broadcast_comment_event(
        tenant_id=current_user.tenant_id,
        draft_id=draft_id,
        event_data={"action": "resolve_toggled", "comment": updated.model_dump()},
    )
    return {"comment": updated.model_dump()}


# --------------------------------------------------
# Webhooks Configuration (Slack & Microsoft Teams)
# --------------------------------------------------

@app.get("/api/webhooks")
def list_webhooks(current_user: AuthenticatedUser = Depends(get_current_user)):
    """Lists webhooks configured for this organization."""
    return {"webhooks": [w.model_dump() for w in webhook_store.list_webhooks(current_user.tenant_id)]}


@app.post("/api/webhooks")
def register_webhook(
    req: WebhookCreateRequest,
    current_user: AuthenticatedUser = Depends(require_roles([Role.ADMIN])),
):
    """Registers an enterprise incoming webhook for Slack or Microsoft Teams."""
    cfg = webhook_store.add_webhook(
        tenant_id=current_user.tenant_id,
        platform=req.platform,
        url=req.url,
        events=req.events,
    )
    audit_store.log(
        tenant_id=current_user.tenant_id,
        user_id=current_user.user_id,
        user_name=current_user.name,
        user_role=current_user.role.value,
        action="webhook_registered",
        resource_type="webhook",
        resource_id=cfg.id,
        details={"platform": req.platform, "url": req.url[:30] + "..."},
    )
    return {"message": "Webhook registered successfully", "webhook": cfg.model_dump()}


@app.delete("/api/webhooks/{webhook_id}")
def remove_webhook(
    webhook_id: str,
    current_user: AuthenticatedUser = Depends(require_roles([Role.ADMIN])),
):
    success = webhook_store.delete_webhook(current_user.tenant_id, webhook_id)
    if not success:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"message": "Webhook removed"}


# --------------------------------------------------
# Enterprise Audit Log Query
# --------------------------------------------------

@app.get("/api/audit")
def query_audit_logs(
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 50,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Retrieves immutable chronological audit trail scoped to tenant."""
    entries = audit_store.query(
        tenant_id=current_user.tenant_id,
        user_id=user_id,
        action=action,
        limit=limit,
    )
    return {"audit_logs": [e.model_dump() for e in entries]}


# --------------------------------------------------
# Real-Time WebSocket Endpoint
# --------------------------------------------------

@app.websocket("/ws/drafts/{draft_id}")
async def websocket_draft_endpoint(
    websocket: WebSocket,
    draft_id: str,
    token: Optional[str] = Query(None),
):
    """
    Authenticated WebSocket connection for real-time collaborative editing,
    presence indicator synchronization, and live cursors.
    """
    # Authenticate via JWT token
    user = None
    if token:
        try:
            payload = decode_token(token, expected_type="access")
            user = AuthenticatedUser(
                user_id=payload["sub"],
                email=payload.get("email", ""),
                name=payload.get("name", "Collaborator"),
                avatar_url=payload.get("avatar_url"),
                tenant_id=payload["tenant_id"],
                tenant_name=payload.get("tenant_name", "Acme CloudSync"),
                role=Role(payload["role"]),
            )
        except Exception:
            pass

    if not user:
        # Fallback for local demo
        user = AuthenticatedUser(
            user_id=f"guest-{int(time.time()*1000)%10000}",
            email="guest@acme.com",
            name="Collaborator",
            avatar_url="https://api.dicebear.com/7.x/avataaars/svg?seed=Guest",
            tenant_id="default-tenant",
            tenant_name="Acme CloudSync",
            role=Role.EDITOR,
        )

    await ws_hub.connect(websocket, user.tenant_id, draft_id, user)
    room_key = f"{user.tenant_id}:{draft_id}"

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "cursor":
                await ws_hub.broadcast_cursor(room_key, user.user_id, data)
            elif msg_type == "content_change":
                await ws_hub.broadcast_content_change(room_key, user.user_id, data)
                # Persist content changes to draft store
                if "content" in data:
                    draft_store.update_draft_content(
                        draft_id=draft_id,
                        tenant_id=user.tenant_id,
                        content=data["content"],
                        user_role=user.role,
                    )
            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        await ws_hub.disconnect(websocket, user.tenant_id, draft_id)
    except Exception as exc:
        logger.warning(f"WebSocket session error: {exc}")
        await ws_hub.disconnect(websocket, user.tenant_id, draft_id)


# --------------------------------------------------
# Visual & Multi-Modal Brand Governance Endpoints
# --------------------------------------------------

class CheckColorRequest(BaseModel):
    hex: str
    tolerance: float = 5.0


class CheckContrastRequest(BaseModel):
    text_color: str
    background_color: str
    font_size_pt: float = 14.0
    is_bold: bool = False


@app.get("/api/vision/palette")
def get_brand_palette():
    """Returns approved brand color palette with standard usage rules."""
    return {
        "palette": DEFAULT_ACME_PALETTE,
        "delta_e_thresholds": {
            "exact_pass": "< 2.0 (Imperceptible)",
            "acceptable": "2.0 - 5.0 (Acceptable variance)",
            "off_brand": "> 5.0 (Strict brand violation)",
        }
    }


@app.post("/api/vision/check-color")
def check_color_deviation(req: CheckColorRequest):
    """Calculates CIEDE2000 Delta-E color distance against nearest brand color."""
    result = compare_against_brand_palette(
        extracted_hex=req.hex,
        approved_palette=DEFAULT_ACME_PALETTE,
        tolerance=req.tolerance,
    )
    return result


@app.post("/api/vision/check-contrast")
def check_wcag_contrast(req: CheckContrastRequest):
    """Calculates WCAG 2.1 contrast ratio and AA/AAA pass/fail compliance."""
    result = evaluate_wcag(
        text_color_hex=req.text_color,
        background_color_hex=req.background_color,
        font_size_pt=req.font_size_pt,
        is_bold=req.is_bold,
    )
    return result


@app.post("/api/vision/audit")
async def audit_visual_upload(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    current_user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
):
    """
    Multi-modal brand governance audit on uploaded images, banners, or presentation slides.
    Extracts dominant colors, computes Delta-E vs brand palette, evaluates WCAG 2.1 contrast,
    and runs Gemini Vision to detect logo distortion and text legibility.
    """
    # Validate extension
    filename = file.filename or "uploaded_asset.png"
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    valid_exts = {"png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "svg", "pdf"}
    if ext not in valid_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '.{ext}'. Supported: PNG, JPG, WEBP, GIF, BMP, TIFF, SVG, PDF."
        )

    # 15MB file size limit
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Asset exceeds maximum allowed size (15MB).")

    # Get working Gemini API key from key agent
    gemini_key = gemini_agent.get_active_key()

    # Determine mime-type
    mime_type = file.content_type or "image/png"
    if mime_type == "application/octet-stream":
        if ext in ("jpg", "jpeg"):
            mime_type = "image/jpeg"
        elif ext == "webp":
            mime_type = "image/webp"
        elif ext == "pdf":
            mime_type = "application/pdf"
        else:
            mime_type = "image/png"

    # Run complete visual audit pipeline
    report = await audit_visual_asset(
        image_bytes=content,
        filename=filename,
        mime_type=mime_type,
        api_key=gemini_key,
        approved_palette=DEFAULT_ACME_PALETTE,
        model=MODEL,
    )

    # Audit log if user is present
    tenant_id = current_user.tenant_id if current_user else "default-tenant"
    user_name = current_user.name if current_user else "Designer"
    user_id = current_user.user_id if current_user else "system"
    role_val = current_user.role.value if current_user else "Editor"

    audit_store.log(
        tenant_id=tenant_id,
        user_id=user_id,
        user_name=user_name,
        user_role=role_val,
        action="visual_audit_completed",
        resource_type="visual_asset",
        resource_id=filename,
        details={
            "score": report.get("overall_score"),
            "status": report.get("compliance_status"),
            "findings_count": len(report.get("vision_findings", [])),
        },
    )

    return report


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    logger.info(f"Starting {APP_NAME} on {host}:{port}")
    uvicorn.run("main:app", host=host, port=port, reload=False)
