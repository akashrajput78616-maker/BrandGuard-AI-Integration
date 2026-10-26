"""
Tests for Document extraction, sanitization, heading detection, and sliding-window chunker.
"""

from rag.chunker import (
    DocumentChunk,
    approximate_tokens,
    chunk_document,
    sanitize_text,
)


def test_sanitize_text():
    raw = "Hello\x00\x07 World!\r\n\r\n\r\n\r\nTest   spacing."
    cleaned = sanitize_text(raw)
    assert "\x00" not in cleaned
    assert "\x07" not in cleaned
    assert "Hello World!" in cleaned
    assert "\n\nTest spacing." in cleaned


def test_approximate_tokens():
    text = "This is a quick sentence of eight words here."
    tokens = approximate_tokens(text)
    assert tokens >= 8
    assert tokens <= 15


def test_chunking_with_heading_preservation():
    doc_id = "test-doc-1"
    tenant_id = "org-test"
    pages = [
        (
            1,
            """# Section 1: Claims & Substantiation Policy
Do not make absolute superiority or guaranteed data-loss claims without a published, approved substantiation source.
Every claim regarding speed, encryption, or reliability must reference verified benchmark data.

# Section 2: Approved Terminology
Use 'cloud backup' rather than 'cloud storage thing'.
Always refer to the flagship product as Acme CloudSync.""",
        )
    ]

    chunks = chunk_document(
        document_id=doc_id,
        tenant_id=tenant_id,
        pages_or_sections=pages,
        target_token_size=25,
        overlap_token_size=5,
    )

    assert len(chunks) >= 2
    assert chunks[0].document_id == doc_id
    assert chunks[0].tenant_id == tenant_id
    assert "Claims" in chunks[0].section_heading or "Section" in chunks[0].section_heading
    assert any("Terminology" in c.section_heading or "cloud backup" in c.content for c in chunks)


def test_chunk_token_boundary():
    # Long text with multiple paragraphs
    long_para = "Word " * 200
    pages = [(1, f"## Policy Header\n\n{long_para}\n\n{long_para}")]

    chunks = chunk_document(
        document_id="doc-long",
        tenant_id="tenant-1",
        pages_or_sections=pages,
        target_token_size=150,
        overlap_token_size=30,
    )

    assert len(chunks) >= 2
    for c in chunks:
        assert c.token_count > 0
        assert c.page_number == 1
