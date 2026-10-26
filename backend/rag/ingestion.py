"""
Document ingestion manager and background pipeline.
Handles file uploads, text extraction, sliding-window chunking, batch embedding,
and vector indexing with real-time status tracking.
"""

import asyncio
import json
import logging
import os
import threading
import time
import uuid
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from .chunker import chunk_document, extract_text
from .embedder import GeminiEmbedder
from .vector_store import VectorStore

logger = logging.getLogger("brandguard.ingestion")


class GuidelineDocument(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = "default-tenant"
    filename: str
    file_type: str  # 'pdf', 'docx', 'txt'
    file_size: int
    status: str = "pending"  # pending, parsing, chunking, embedding, indexed, failed
    parse_status: str = "Not started"
    chunk_count: int = 0
    token_count: int = 0
    error_message: Optional[str] = None
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)


class IngestionManager:
    def __init__(
        self,
        vector_store: VectorStore,
        embedder: GeminiEmbedder,
        metadata_file: str = "data/documents_metadata.json",
        storage_dir: str = "data/uploads",
    ):
        self.lock = threading.Lock()
        self.vector_store = vector_store
        self.embedder = embedder
        self.metadata_file = metadata_file
        self.storage_dir = storage_dir
        self.documents: Dict[str, GuidelineDocument] = {}
        self._load_metadata()

    def _load_metadata(self):
        if not os.path.exists(self.metadata_file):
            return
        try:
            with open(self.metadata_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data:
                    doc = GuidelineDocument(**item)
                    self.documents[doc.id] = doc
        except Exception as e:
            logger.warning(f"Failed to load document metadata: {e}")

    def _save_metadata(self):
        try:
            os.makedirs(os.path.dirname(self.metadata_file), exist_ok=True)
            with open(self.metadata_file, "w", encoding="utf-8") as f:
                json.dump(
                    [d.model_dump() for d in self.documents.values()],
                    f,
                    ensure_ascii=False,
                    indent=2,
                )
        except Exception as e:
            logger.warning(f"Failed to save document metadata: {e}")

    def list_documents(self, tenant_id: str = "default-tenant") -> List[GuidelineDocument]:
        with self.lock:
            docs = [
                d
                for d in self.documents.values()
                if d.tenant_id == tenant_id or tenant_id == "all"
            ]
            return sorted(docs, key=lambda d: d.created_at, reverse=True)

    def get_document(self, document_id: str, tenant_id: str = "default-tenant") -> Optional[GuidelineDocument]:
        with self.lock:
            doc = self.documents.get(document_id)
            if doc and (doc.tenant_id == tenant_id or tenant_id == "all"):
                return doc
            return None

    def register_document(
        self,
        filename: str,
        file_bytes: bytes,
        tenant_id: str = "default-tenant",
    ) -> GuidelineDocument:
        """Saves file to disk and registers document in pending state."""
        ext = filename.lower().split(".")[-1] if "." in filename else "txt"
        doc = GuidelineDocument(
            tenant_id=tenant_id,
            filename=filename,
            file_type=ext,
            file_size=len(file_bytes),
            status="pending",
            parse_status="Queued for processing",
        )

        with self.lock:
            self.documents[doc.id] = doc
            self._save_metadata()

        os.makedirs(self.storage_dir, exist_ok=True)
        file_path = os.path.join(self.storage_dir, f"{doc.id}.{ext}")
        with open(file_path, "wb") as f:
            f.write(file_bytes)

        return doc

    def process_document(self, document_id: str) -> bool:
        """
        Synchronously (or inside worker) extracts text, chunks, embeds, and indexes document.
        """
        with self.lock:
            doc = self.documents.get(document_id)
            if not doc:
                return False
            doc.status = "parsing"
            doc.parse_status = "Extracting text from document"
            doc.updated_at = time.time()
            self._save_metadata()

        file_path = os.path.join(self.storage_dir, f"{doc.id}.{doc.file_type}")
        if not os.path.exists(file_path):
            with self.lock:
                doc.status = "failed"
                doc.parse_status = "Stored file not found"
                doc.error_message = "File disappeared from disk"
                self._save_metadata()
            return False

        try:
            with open(file_path, "rb") as f:
                file_bytes = f.read()

            # 1. Parse / extract text per page/section
            pages = extract_text(file_bytes, doc.filename)

            with self.lock:
                doc.status = "chunking"
                doc.parse_status = f"Chunking {len(pages)} extracted sections"
                self._save_metadata()

            # 2. Chunk text (~500-800 tokens with overlap)
            chunks = chunk_document(
                document_id=doc.id,
                tenant_id=doc.tenant_id,
                pages_or_sections=pages,
            )

            if not chunks:
                with self.lock:
                    doc.status = "indexed"
                    doc.parse_status = "Completed (empty document)"
                    doc.chunk_count = 0
                    self._save_metadata()
                return True

            with self.lock:
                doc.status = "embedding"
                doc.parse_status = f"Generating Gemini embeddings for {len(chunks)} chunks"
                doc.chunk_count = len(chunks)
                doc.token_count = sum(c.token_count for c in chunks)
                self._save_metadata()

            # 3. Batch embed chunk contents
            chunk_texts = [f"{c.section_heading}\n{c.content}" for c in chunks]
            embeddings = self.embedder.embed_texts(chunk_texts)

            # 4. Store in vector database
            # Remove any prior chunks for this document
            self.vector_store.delete_document(doc.id, doc.tenant_id)
            self.vector_store.add_chunks(chunks, embeddings)

            with self.lock:
                doc.status = "indexed"
                doc.parse_status = f"Successfully indexed {len(chunks)} chunks"
                doc.updated_at = time.time()
                self._save_metadata()

            logger.info(f"Document {doc.filename} ({doc.id}) indexed with {len(chunks)} chunks.")
            return True

        except Exception as exc:
            logger.error(f"Failed to ingest document {doc.id}: {exc}", exc_info=True)
            with self.lock:
                doc.status = "failed"
                doc.parse_status = "Error processing document"
                doc.error_message = str(exc)
                doc.updated_at = time.time()
                self._save_metadata()
            return False

    def delete_document(self, document_id: str, tenant_id: str = "default-tenant") -> bool:
        with self.lock:
            doc = self.documents.get(document_id)
            if not doc or (doc.tenant_id != tenant_id and tenant_id != "all"):
                return False
            del self.documents[document_id]
            self._save_metadata()

        # Delete vector chunks
        self.vector_store.delete_document(document_id, tenant_id)

        # Remove stored raw file
        file_path = os.path.join(self.storage_dir, f"{document_id}.{doc.file_type}")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
        return True

    def reindex_document(self, document_id: str, tenant_id: str = "default-tenant") -> bool:
        doc = self.get_document(document_id, tenant_id)
        if not doc:
            return False
        return self.process_document(document_id)
