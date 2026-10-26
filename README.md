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
    subgraph Client [Frontend — React 18 + Vite]
        UI[Review Workspace & Editor]
        KB[Knowledge Base RAG Uploader]
        Collab[Real-Time Collaboration Bar]
        VisStudio[Visual Governance Studio]
    end

    subgraph Backend [Backend API — FastAPI & Uvicorn]
        Auth[JWT & RBAC Guards<br/>Admin / Reviewer / Editor / Viewer]
        WSHub[WebSocket Hub<br/>/ws/drafts/{id}]
        RAGEngine[RAG Grounded Review Engine]
        VisionEngine[Multi-Modal Vision Processor]
        KeyPool[Multi-Key Failover Agent]
    end

    subgraph Storage [Persistent Storage & Vector Stores]
        VStore[(Pluggable Vector Store<br/>Local / PgVector / Pinecone)]
        AuditDB[(Immutable Audit Trail<br/>& Draft State Store)]
    end

    subgraph AI [Google Gemini AI Ecosystem]
        EmbedModel[text-embedding-004]
        GenModel[Gemini 2.5 / 3.8 Flash]
        VisionModel[Gemini Vision Multi-Modal]
    end

    KB -->|PDF / DOCX Upload| RAGEngine
    RAGEngine -->|Chunks| EmbedModel
    EmbedModel -->|768d Vectors| VStore

    UI -->|Review Request| RAGEngine
    VStore -->|Top-K Context Chunks| RAGEngine
    RAGEngine -->|Prompt + Grounding| GenModel
    GenModel -->|Citations & Findings| UI

    UI <-->|Presence & Live Cursors| WSHub
    WSHub -->|Events| UI

    VisStudio -->|Image / Banner Upload| VisionEngine
    VisionEngine -->|CIEDE2000 & WCAG| VisStudio
    VisionEngine -->|Image Bytes + Prompt| VisionModel
    VisionModel -->|Bounding Boxes 0..1000| VisStudio
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

## 🌐 Deployment Notes: Vercel vs Dedicated Backend

BrandGuard is architected to run across modern cloud hosting environments:

| Component | Vercel (`https://frontend-psi-self-29.vercel.app`) | Dedicated Backend (Render / Fly.io / AWS) |
| :--- | :--- | :--- |
| **Frontend SPA** | ✅ Vite static build with global CDN edge caching. | Optional (can serve SPA via static file mount). |
| **Serverless Review API** | ✅ REST endpoints, health checks, deterministic rules. | ✅ REST endpoints with auto-scaling workers. |
| **Real-Time WebSockets** | ⚠️ Vercel Serverless terminates after HTTP request. | ✅ Persistent stateful connections (`/ws/drafts/{id}`). |
| **PostgreSQL & Vector Store**| External DB URL (`DATABASE_URL`). | ✅ Direct persistent connection pool (`asyncpg`). |
| **Visual Asset Storage** | Ephemeral memory buffer for immediate inspection. | S3 / MinIO object store integration. |

> **Recommendation:** Deploy the React frontend to **Vercel** (`frontend/`) and point `VITE_BACKEND_URL` to a containerized FastAPI service on **Render**, **Fly.io**, or **AWS ECS** (`backend/Dockerfile`).

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
