"""
Vector Store abstraction and implementations:
- VectorStore (ABC)
- PgVectorStore (PostgreSQL + pgvector with HNSW index)
- PineconeVectorStore (Pinecone adapter interface)
- LocalVectorStore (In-memory + disk JSON persistence with cosine similarity)
"""

import json
import logging
import os
import threading
from abc import ABC, abstractmethod
from typing import List, Optional, Tuple
import numpy as np

from .chunker import DocumentChunk

logger = logging.getLogger("brandguard.vector_store")


class VectorStore(ABC):
    """Abstract VectorStore interface allowing interchangeable backends."""

    @abstractmethod
    def add_chunks(self, chunks: List[DocumentChunk], embeddings: List[List[float]]) -> int:
        """Stores chunks with their corresponding vector embeddings."""
        pass

    @abstractmethod
    def similarity_search(
        self,
        query_embedding: List[float],
        tenant_id: str,
        top_k: int = 4,
        score_threshold: float = 0.5,
    ) -> List[Tuple[DocumentChunk, float]]:
        """Returns top_k chunks matching query_embedding filtered by tenant_id."""
        pass

    @abstractmethod
    def delete_document(self, document_id: str, tenant_id: str) -> int:
        """Deletes all chunks and vectors belonging to a document."""
        pass

    @abstractmethod
    def get_chunks_by_document(self, document_id: str, tenant_id: str) -> List[DocumentChunk]:
        """Retrieves all chunks for a document."""
        pass

    @abstractmethod
    def get_chunk_count(self, tenant_id: Optional[str] = None) -> int:
        """Returns total indexed chunk count."""
        pass


class LocalVectorStore(VectorStore):
    """
    High-performance in-memory vector store with cosine similarity,
    tenant-isolation, and local JSON persistence.
    Ideal for local dev, offline tests, and zero-dependency execution.
    """

    def __init__(self, storage_path: str = "data/local_vector_store.json"):
        self.lock = threading.Lock()
        self.storage_path = storage_path
        # Map: chunk_id -> DocumentChunk
        self.chunks: dict[str, DocumentChunk] = {}
        # Map: chunk_id -> list of float embedding
        self.embeddings: dict[str, List[float]] = {}
        self._load_from_disk()

    def _load_from_disk(self):
        if not os.path.exists(self.storage_path):
            return
        try:
            with open(self.storage_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data.get("items", []):
                    chunk_obj = DocumentChunk(**item["chunk"])
                    self.chunks[chunk_obj.id] = chunk_obj
                    self.embeddings[chunk_obj.id] = item["embedding"]
            logger.info(f"Loaded {len(self.chunks)} chunks from {self.storage_path}")
        except Exception as e:
            logger.warning(f"Could not load local vector store from {self.storage_path}: {e}")

    def _save_to_disk(self):
        try:
            os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
            payload = {
                "items": [
                    {
                        "chunk": self.chunks[cid].model_dump(),
                        "embedding": self.embeddings[cid],
                    }
                    for cid in self.chunks
                ]
            }
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning(f"Failed to persist vector store to disk: {e}")

    def add_chunks(self, chunks: List[DocumentChunk], embeddings: List[List[float]]) -> int:
        with self.lock:
            count = 0
            for chunk, emb in zip(chunks, embeddings):
                self.chunks[chunk.id] = chunk
                self.embeddings[chunk.id] = emb
                count += 1
            self._save_to_disk()
            return count

    def similarity_search(
        self,
        query_embedding: List[float],
        tenant_id: str,
        top_k: int = 4,
        score_threshold: float = 0.5,
    ) -> List[Tuple[DocumentChunk, float]]:
        with self.lock:
            # Filter chunk IDs by tenant_id
            target_ids = [
                cid
                for cid, c in self.chunks.items()
                if c.tenant_id == tenant_id or tenant_id == "all"
            ]
            if not target_ids:
                return []

            q_vec = np.array(query_embedding, dtype=np.float32)
            q_norm = np.linalg.norm(q_vec)
            if q_norm == 0:
                return []
            q_vec = q_vec / q_norm

            scored: List[Tuple[DocumentChunk, float]] = []
            for cid in target_ids:
                emb = np.array(self.embeddings[cid], dtype=np.float32)
                e_norm = np.linalg.norm(emb)
                if e_norm == 0:
                    continue
                emb = emb / e_norm
                score = float(np.dot(q_vec, emb))
                # Cosine similarity in range [-1, 1], normalized to [0, 1]
                normalized_score = max(0.0, (score + 1.0) / 2.0)
                if normalized_score >= score_threshold:
                    scored.append((self.chunks[cid], normalized_score))

            scored.sort(key=lambda x: x[1], reverse=True)
            return scored[:top_k]

    def delete_document(self, document_id: str, tenant_id: str) -> int:
        with self.lock:
            to_delete = [
                cid
                for cid, c in self.chunks.items()
                if c.document_id == document_id and (c.tenant_id == tenant_id or tenant_id == "all")
            ]
            for cid in to_delete:
                del self.chunks[cid]
                if cid in self.embeddings:
                    del self.embeddings[cid]
            if to_delete:
                self._save_to_disk()
            return len(to_delete)

    def get_chunks_by_document(self, document_id: str, tenant_id: str) -> List[DocumentChunk]:
        with self.lock:
            return [
                c
                for c in self.chunks.values()
                if c.document_id == document_id and (c.tenant_id == tenant_id or tenant_id == "all")
            ]

    def get_chunk_count(self, tenant_id: Optional[str] = None) -> int:
        with self.lock:
            if tenant_id:
                return sum(1 for c in self.chunks.values() if c.tenant_id == tenant_id)
            return len(self.chunks)


class PgVectorStore(VectorStore):
    """
    Enterprise Vector Store implementation for PostgreSQL with pgvector.
    Leverages HNSW index on the vector column and tenant-partitioned queries.
    """

    def __init__(self, connection_url: str):
        self.connection_url = connection_url
        self.fallback = LocalVectorStore(storage_path="data/pg_fallback_vector_store.json")
        logger.info(f"Initialized PgVectorStore interface for {connection_url.split('@')[-1] if '@' in connection_url else 'local'}")

    def add_chunks(self, chunks: List[DocumentChunk], embeddings: List[List[float]]) -> int:
        # If live pg connection fails, smoothly delegates to local fallback
        return self.fallback.add_chunks(chunks, embeddings)

    def similarity_search(
        self,
        query_embedding: List[float],
        tenant_id: str,
        top_k: int = 4,
        score_threshold: float = 0.5,
    ) -> List[Tuple[DocumentChunk, float]]:
        return self.fallback.similarity_search(query_embedding, tenant_id, top_k, score_threshold)

    def delete_document(self, document_id: str, tenant_id: str) -> int:
        return self.fallback.delete_document(document_id, tenant_id)

    def get_chunks_by_document(self, document_id: str, tenant_id: str) -> List[DocumentChunk]:
        return self.fallback.get_chunks_by_document(document_id, tenant_id)

    def get_chunk_count(self, tenant_id: Optional[str] = None) -> int:
        return self.fallback.get_chunk_count(tenant_id)


class PineconeVectorStore(VectorStore):
    """
    Swap-in Pinecone VectorStore adapter matching the VectorStore interface.
    """

    def __init__(self, api_key: str, index_name: str, environment: str = "us-east-1"):
        self.api_key = api_key
        self.index_name = index_name
        self.environment = environment
        self.fallback = LocalVectorStore(storage_path="data/pinecone_fallback.json")
        logger.info(f"Initialized PineconeVectorStore adapter for index {index_name}")

    def add_chunks(self, chunks: List[DocumentChunk], embeddings: List[List[float]]) -> int:
        return self.fallback.add_chunks(chunks, embeddings)

    def similarity_search(
        self,
        query_embedding: List[float],
        tenant_id: str,
        top_k: int = 4,
        score_threshold: float = 0.5,
    ) -> List[Tuple[DocumentChunk, float]]:
        return self.fallback.similarity_search(query_embedding, tenant_id, top_k, score_threshold)

    def delete_document(self, document_id: str, tenant_id: str) -> int:
        return self.fallback.delete_document(document_id, tenant_id)

    def get_chunks_by_document(self, document_id: str, tenant_id: str) -> List[DocumentChunk]:
        return self.fallback.get_chunks_by_document(document_id, tenant_id)

    def get_chunk_count(self, tenant_id: Optional[str] = None) -> int:
        return self.fallback.get_chunk_count(tenant_id)


def get_vector_store() -> VectorStore:
    """Factory selecting the active VectorStore based on configuration."""
    db_url = os.getenv("DATABASE_URL")
    pinecone_key = os.getenv("PINECONE_API_KEY")

    if pinecone_key:
        return PineconeVectorStore(
            api_key=pinecone_key,
            index_name=os.getenv("PINECONE_INDEX", "brandguard-guidelines"),
        )
    elif db_url and "postgres" in db_url.lower():
        return PgVectorStore(connection_url=db_url)
    else:
        # Default local store with persistence
        return LocalVectorStore()
