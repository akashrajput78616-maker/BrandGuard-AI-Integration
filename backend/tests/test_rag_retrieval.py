"""
Tests for RAG vector similarity search, tenant isolation, and grounded retrieval.
"""

import pytest
from rag.chunker import DocumentChunk
from rag.embedder import GeminiEmbedder, generate_deterministic_embedding
from rag.vector_store import LocalVectorStore


def test_deterministic_embedding():
    emb1 = generate_deterministic_embedding("Acme CloudSync provides enterprise backups.")
    emb2 = generate_deterministic_embedding("Acme CloudSync provides enterprise backups.")
    emb3 = generate_deterministic_embedding("Completely unrelated text about cooking recipes.")

    assert len(emb1) == 768
    assert emb1 == emb2  # Exact match for identical text
    assert emb1 != emb3


def test_vector_store_tenant_isolation(tmp_path):
    store_file = str(tmp_path / "test_vectors.json")
    store = LocalVectorStore(storage_path=store_file)

    chunk_tenant_a = DocumentChunk(
        document_id="doc-a",
        tenant_id="tenant-alpha",
        chunk_index=0,
        section_heading="Alpha Policy",
        content="Alpha confidential brand guidelines.",
        token_count=10,
    )
    chunk_tenant_b = DocumentChunk(
        document_id="doc-b",
        tenant_id="tenant-beta",
        chunk_index=0,
        section_heading="Beta Policy",
        content="Beta confidential brand guidelines.",
        token_count=10,
    )

    emb_a = generate_deterministic_embedding(chunk_tenant_a.content)
    emb_b = generate_deterministic_embedding(chunk_tenant_b.content)

    store.add_chunks([chunk_tenant_a, chunk_tenant_b], [emb_a, emb_b])

    # Search for tenant-alpha should never return tenant-beta chunks
    query_emb = generate_deterministic_embedding("brand guidelines")
    results_alpha = store.similarity_search(query_emb, tenant_id="tenant-alpha", top_k=5, score_threshold=0.0)
    assert len(results_alpha) == 1
    assert results_alpha[0][0].tenant_id == "tenant-alpha"

    results_beta = store.similarity_search(query_emb, tenant_id="tenant-beta", top_k=5, score_threshold=0.0)
    assert len(results_beta) == 1
    assert results_beta[0][0].tenant_id == "tenant-beta"


def test_vector_store_delete_document(tmp_path):
    store_file = str(tmp_path / "test_delete.json")
    store = LocalVectorStore(storage_path=store_file)

    chunk = DocumentChunk(
        document_id="doc-del",
        tenant_id="org-1",
        chunk_index=0,
        content="Temporary guideline to delete.",
        token_count=10,
    )
    emb = generate_deterministic_embedding(chunk.content)
    store.add_chunks([chunk], [emb])

    assert store.get_chunk_count("org-1") == 1
    deleted = store.delete_document("doc-del", "org-1")
    assert deleted == 1
    assert store.get_chunk_count("org-1") == 0
