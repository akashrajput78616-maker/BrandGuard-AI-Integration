# BrandGuard — Intelligent Brand Governance Platform

[![Inkloom AI Hackathon](https://img.shields.io/badge/Hackathon-Inkloom%20Round%203%20Complete-0fa3a3?style=for-the-badge)](https://github.com/akashrajput78616-maker/BrandGuard-AI-Integration)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite%205-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Google Gemini](https://img.shields.io/badge/AI%20Engine-Gemini%202.5%20%2F%203.8%20Flash-4285F4?style=for-the-badge&logo=google)](https://ai.google.dev/)
[![Tests](https://img.shields.io/badge/Tests-23%20Passing-brightgreen?style=for-the-badge)](https://github.com/akashrajput78616-maker/BrandGuard-AI-Integration)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://frontend-psi-self-29.vercel.app)

> **Catch off-brand tone, outdated facts, unsupported claims, unapproved visual assets, and accessibility violations before publication — with grounded RAG source citations, real-time collaboration, CIEDE2000 color delta math, and mandatory human-in-the-loop oversight.**

---

## 📌 Project Overview

Marketing, product, and communications teams publish across hundreds of touchpoints daily. Without automated governance, unsupported superlatives, unapproved color variants, distorted logos, and non-compliant claims slip through — risking brand equity and regulatory exposure.

**BrandGuard** solves this by unifying:
1. **RAG-Powered Document Ingestion & Grounded Retrieval** (PDF/DOCX guideline vectorization, strict quote citation, or abstention).
2. **Enterprise Collaboration & RBAC Governance** (real-time WebSocket presence, text-anchored threaded inline comments, role-based approval queues, Slack/Teams webhooks).
3. **Multi-Modal Visual Governance Studio** (CIEDE2000 $\Delta E_{00}$ color distance, k-means palette clustering, WCAG 2.1 contrast checks, and Gemini Vision logo integrity inspection with interactive bounding boxes).

---

## 🚀 Complete System Architecture

```mermaid
flowchart TD
    subgraph Client ["Frontend (React 18 + Vite)"]
        UI["Review Workspace & Editor"]
        KB["Knowledge Base RAG Uploader"]
        Collab["Real-Time Collaboration Bar"]
        VisStudio["Visual Governance Studio"]
    end

    subgraph Backend ["Backend API (FastAPI & Uvicorn)"]
        Auth["JWT & RBAC Guards<br/>Admin / Reviewer / Editor / Viewer"]
        WSHub["WebSocket Hub<br/>/ws/drafts/:draft_id"]
        RAGEngine["RAG Grounded Review Engine"]
        VisionEngine["Multi-Modal Vision Processor"]
        KeyPool["Multi-Key Failover Agent"]
    end

    subgraph Storage ["Persistent Storage & Vector Stores"]
        VStore[("Pluggable Vector Store<br/>Local / PgVector / Pinecone")]
        AuditDB[("Immutable Audit Trail<br/>& Draft State Store")]
    end

    subgraph AI ["Google Gemini AI Ecosystem"]
        EmbedModel["text-embedding-004"]
        GenModel["Gemini 2.5 / 3.8 Flash"]
        VisionModel["Gemini Vision Multi-Modal"]
    end

    KB -->|"PDF / DOCX Upload"| RAGEngine
    RAGEngine -->|"Chunks"| EmbedModel
    EmbedModel -->|"768d Vectors"| VStore

    UI -->|"Review Request"| RAGEngine
    VStore -->|"Top-K Context Chunks"| RAGEngine
    RAGEngine -->|"Prompt + Grounding"| GenModel
    GenModel -->|"Citations & Findings"| UI

    UI <-->|"Presence & Live Cursors"| WSHub
    WSHub -->|"Events"| UI

    VisStudio -->|"Image / Banner Upload"| VisionEngine
    VisionEngine -->|"CIEDE2000 & WCAG"| VisStudio
    VisionEngine -->|"Image Bytes + Prompt"| VisionModel
    VisionModel -->|"Bounding Boxes 0..1000"| VisStudio
```

---

## ✨ Round 3 Completed Features

### Feature 1: RAG-Powered Knowledge Base & Document Ingestion
* **Document Ingestion:** Drag-and-drop ingestion of enterprise brand guideline documents in **PDF** (`pypdf`) and **DOCX** (`python-docx`).
* **Sliding Window Chunker (`chunker.py`):** Configurable 500-800 token sliding windows with 100-token overlap, preserving heading hierarchies, section breadcrumbs, and page numbers.
* **Gemini Embedding Engine (`embedder.py`):** Batched embedding generation via `text-embedding-004` with deterministic fallback.
* **Pluggable Vector Store (`vector_store.py`):** Abstract `VectorStore` base class with:
  * `LocalVectorStore`: In-memory vector search with JSON snapshot persistence (zero infrastructure required).
  * `PgVectorStore`: Enterprise PostgreSQL vector store leveraging `pgvector` and HNSW indexes (`vector_cosine_ops`).
  * `PineconeVectorStore`: Managed cloud vector store adapter.
* **Grounded Review Engine (`review_engine.py`):** Contextual top-k retrieval injecting guidelines into Gemini prompts. Enforces **strict source attribution** (source document, section, and exact quoted snippet) or explicit abstention when no policy is matched.
* **Frontend Knowledge Base (`KnowledgeBaseRAG.jsx`):** Document list, upload progress, parsing status badges (`PENDING`, `PARSING`, `EMBEDDING`, `INDEXED`, `FAILED`), chunk inspector drawer, and live semantic search sandbox.

### Feature 2: Multi-User Collaboration & Enterprise Authentication
* **Enterprise Authentication (`auth/`):**
  * HTTP-only cookies with JWT access & refresh tokens.
  * Role-Based Access Control (**Admin**, **Reviewer**, **Editor**, **Viewer**).
  * Password hashing via PBKDF2 with SHA-256 and unique salt per user.
* **Real-Time WebSocket Hub (`collab/ws_hub.py`):**
  * Room manager `/ws/drafts/{draft_id}` with live user presence avatars and real-time cursor broadcast.
  * Synchronized collaborative draft editing across connected browsers.
* **Threaded Inline Comments (`collab/comments.py`):**
  * Text-range anchored comments (`start_offset`, `end_offset`, `selected_text`).
  * Reply threads, resolve/unresolve state toggles, and WebSocket broadcast.
* **Approval Workflow State Machine (`collab/approvals.py`):**
  * Enforced lifecycle: `Draft` → `In Review` → `Approved` / `Changes Requested`.
  * Server-side authorization check (Editors cannot approve; only Reviewers/Admins).
* **Enterprise Webhook Notifications (`collab/webhooks.py`):**
  * Outgoing webhook dispatcher for **Slack** and **Microsoft Teams**.
  * Dispatches on `review_requested`, `decision_approved`, `decision_rejected`, and `comment_added` with exponential backoff retry.
* **Chronological Audit Trail (`collab/audit.py`):**
  * Tenant-isolated, immutable log recording timestamp, actor, role, action, and change details.

### Feature 3: Visual & Multi-Modal Brand Governance Studio
* **Perceptual Color Science (`vision/delta_e.py`):**
  * Exact **CIEDE2000 ($\Delta E_{00}$)** color difference engine according to ISO/CIE 11664-6:2014.
  * sRGB $\to$ CIE XYZ (D65 illuminant, 2° observer) $\to$ CIE $L^*a^*b^*$ transformations.
  * Tolerances: $\Delta E < 2.0$ (Pass/Imperceptible), $2.0 \le \Delta E \le 5.0$ (Acceptable brand variation), $\Delta E > 5.0$ (Off-brand violation).
* **Dominant Color Extraction (`vision/palette.py`):**
  * K-means clustering (`MiniBatchKMeans` / Pillow) extracting top 5 dominant colors and pixel presence percentages.
  * Pairwise matching against approved brand palette.
* **WCAG 2.1 Contrast Engine (`vision/contrast.py`):**
  * Relative luminance formula $L = 0.2126 R_{lin} + 0.7152 G_{lin} + 0.0722 B_{lin}$.
  * Contrast ratio $(L_1 + 0.05) / (L_2 + 0.05)$.
  * Level AA (4.5:1 normal, 3:1 large) and Level AAA (7:1 normal, 4.5:1 large) evaluation with actionable contrast increase suggestions.
* **Gemini Vision Inspection (`vision/gemini_vision.py`):**
  * Multi-modal visual asset review detecting unapproved logo variations (aspect ratio distortion, unauthorized coloring, clear-space margin intrusion, blurriness).
  * Returns normalized bounding boxes `[ymin, xmin, ymax, xmax]` on a 0–1000 scale.
* **Interactive Visual Studio UI (`VisualGovernanceStudio.jsx`):**
  * Drag-and-drop asset uploader + 1-click test presets (Approved Banner vs Stretched Logo Violation).
  * Interactive canvas with hoverable/clickable SVG bounding-box overlays.
  * Color swatch list with live $\Delta E$ pills and percentage frequency bars.
  * WCAG AA/AAA compliance cards with live text simulation.
  * Interactive Color Sandbox for ad-hoc hex code evaluation.
  * Human-in-the-loop sign-off banner.

---

## 🧪 Automated Test Suite (23 Tests)

The backend features a comprehensive test suite covering all modules:

```powershell
cd backend
.\.venv\Scripts\activate
pytest
```

**Results:**
```
============================= test session starts =============================
collected 23 items

tests\test_auth_guards.py ....                                           [ 17%]
tests\test_chunker.py ....                                               [ 34%]
tests\test_contrast.py ...                                               [ 47%]
tests\test_delta_e.py ....                                               [ 65%]
tests\test_rag_retrieval.py ...                                          [ 78%]
tests\test_visual_processor.py .....                                     [100%]

======================= 23 passed, 3 warnings in 4.98s ========================
```

---

## 🌐 Production Deployment Guide (Free-Tier Model)

BrandGuard is designed for zero-cost production deployment on battle-tested free tiers:

```mermaid
flowchart LR
    User(["Client Browser"])
    subgraph Frontend_Vercel ["Frontend: Vercel (Edge CDN)"]
        VercelApp["https://frontend-psi-self-29.vercel.app"]
    end
    subgraph Backend_Render ["Backend: Render Free Web Service"]
        FastAPI["Uvicorn / FastAPI ASGI<br/>0.0.0.0:$PORT"]
        WSServer["WebSocket Server<br/>/ws/drafts/{id}"]
        RAGWorker["Ingestion & Embedding Worker"]
    end
    subgraph DB_Cloud ["Database: Neon / Supabase (Free Tier)"]
        Postgres[("PostgreSQL 16 + pgvector<br/>(Vector Store & Auth)")]
    end
    subgraph AI_Cloud ["AI Engine: Google AI Studio"]
        GeminiFlash["Gemini 2.5 Flash / Embeddings"]
    end

    User -->|"HTTPS (SPA)"| VercelApp
    User -->|"HTTPS (REST + Cookies)"| FastAPI
    User -->|"WSS (Live Collab)"| WSServer
    FastAPI -->|"SSL Pool"| Postgres
    FastAPI -->|"API Calls"| GeminiFlash
```

### 📋 Environment Variables Reference

#### Frontend (`Vercel Project Settings > Environment Variables`)

| Variable | Required | Example Value | Description |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | **Yes** | `https://brandguard-api-np6g.onrender.com` | HTTPS base URL of the deployed Render backend |
| `VITE_WS_URL` | **Yes** | `wss://brandguard-api-np6g.onrender.com` | WSS base URL for persistent real-time WebSockets |

#### Backend (`Render Web Service > Environment`)

| Variable | Required | Example Value | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | Auto | `10000` | Port assigned by Render (FastAPI listens on `0.0.0.0:$PORT`) |
| `DATABASE_URL` | **Yes** | `postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require` | PostgreSQL connection string from Neon or Supabase |
| `VECTOR_STORE_PROVIDER` | **Yes** | `postgres` | Sets vector store engine (`postgres` or fallback `local`) |
| `GEMINI_API_KEY` | **Yes** | `AIzaSy...` | Google Gemini API key from Google AI Studio |
| `GEMINI_API_KEYS` | Optional | `key1,key2,key3` | Comma-separated pool for automatic failover on rate limits |
| `GEMINI_MODEL` | Default | `gemini-2.5-flash` | Gemini model for grounded reviews and vision audit |
| `JWT_SECRET` | **Yes** | `32+ character random string` | Secret key used to sign access tokens |
| `JWT_REFRESH_SECRET` | **Yes** | `32+ character random string` | Secret key used to sign refresh tokens |
| `SECURE_COOKIES` | **Yes** | `true` | Enables `SameSite=None` and `Secure=True` for cross-site cookies |
| `FRONTEND_URL` | **Yes** | `https://frontend-psi-self-29.vercel.app` | Vercel domain for strict CORS credentials verification |
| `FRONTEND_ORIGINS` | Optional | `http://localhost:5173,https://frontend-psi-self-29.vercel.app` | Comma-separated list of permitted CORS origins |
| `SLACK_WEBHOOK_URL` | Optional | `https://hooks.slack.com/services/...` | Slack Incoming Webhook for approval notifications |
| `TEAMS_WEBHOOK_URL` | Optional | `https://outlook.office.com/webhook/...` | Microsoft Teams Connector Webhook URL |
| `GOOGLE_CLIENT_ID` | Optional | `xyz.apps.googleusercontent.com` | Google Cloud OAuth 2.0 Web Client ID |
| `GOOGLE_CLIENT_SECRET`| Optional | `GOCSPX-...` | Google Cloud OAuth 2.0 Client Secret |

---

### 🚀 Step-by-Step Deployment Order

1. **Database (Neon / Supabase)**:
   - Create a free PostgreSQL instance.
   - Run migrations locally to activate `vector` & `uuid-ossp` extensions:
     ```bash
     export DATABASE_URL="postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require"
     npm run migrate
     ```
2. **Backend (Render Web Service)**:
   - Connect GitHub repo: root directory `backend`, runtime `Python 3`.
   - Build Command: `pip install -r requirements.txt`.
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`.
   - Health Check Path: `/health`.
   - Add backend environment variables listed above.
3. **Verify Backend**:
   - Access `https://<backend>.onrender.com/health` in browser. Expect: `{"status": "ok", "service": "BrandGuard AI Review API", ...}`.
4. **Frontend (Vercel)**:
   - In Vercel Project Settings, add `VITE_API_URL` and `VITE_WS_URL`.
   - Trigger a production Redeploy.
5. **OAuth Consoles (Google & Microsoft)**:
   - Add Authorized JavaScript Origins: `https://frontend-psi-self-29.vercel.app` and `http://localhost:5173`.
   - Add Authorized Redirect URIs: `https://<backend>.onrender.com/api/auth/callback/google` and `http://localhost:8000/api/auth/callback/google`.

---

### ❄️ Render Free-Tier Cold-Start Handling

Render free instances spin down into a sleep state after **15 minutes of inactivity**:
- **First Request Latency**: Cold start takes **30 to 50 seconds** while the container re-provisions.
- **Client Auto-Wakeup**: BrandGuard's frontend detects offline WebSocket state and displays a **"⚡ Waking up the server..."** banner while pinging `/health` with exponential backoff (1.5s, 3s, 6s, 12s, capped at 15s) until connection establishes automatically.
- **Zero Data Loss**: In-memory edits remain safely buffered in the browser until reconnection completes.

---

### 🔧 Troubleshooting & Common Issues

| Issue | Root Cause | Solution |
| :--- | :--- | :--- |
| **CORS 403 / Credential error** | Modern browsers disallow `Access-Control-Allow-Origin: *` when credentials are included. | In Render env, set `FRONTEND_URL=https://frontend-psi-self-29.vercel.app`. The backend automatically assigns explicit matching origins. |
| **Login cookies not saving** | Cross-site cookies across different domains (Vercel SPA ↔ Render API) require `SameSite=None; Secure`. | Ensure `SECURE_COOKIES=true` in Render. Access your frontend strictly over `https://`. |
| **WebSocket `wss://` fails** | Mixed content blocked: Browsers block unencrypted `ws://` on `https://` pages. | Ensure `VITE_WS_URL` starts with `wss://` and points to your Render domain (never `ws://` in production). |
| **OAuth `redirect_uri_mismatch`** | The redirect URI in Google/Azure console does not match the exact backend hostname. | Verify `https://<backend>.onrender.com/api/auth/callback/google` matches character-for-character without trailing slashes. |


---

## 📦 Local Development Guide

### 1. Backend Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# Configure your GEMINI_API_KEY in .env
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup

```powershell
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` to access the full BrandGuard platform.

---

## 📄 License & Attribution

Built with ❤️ by **Akash Rajput** for the **Inkloom AI Hackathon 2026**.  
Licensed under the [MIT License](LICENSE).
