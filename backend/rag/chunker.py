"""
Document extraction and chunking pipeline for PDF, DOCX, and TXT guidelines.
Splits text into ~500-800 token chunks with overlap while preserving section headings and page metadata.
"""

import io
import re
import uuid
from typing import List, Optional
from pydantic import BaseModel, Field


class DocumentChunk(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    document_id: str
    tenant_id: str = "default-tenant"
    chunk_index: int
    section_heading: str = "General"
    page_number: Optional[int] = None
    content: str
    token_count: int
    metadata: dict = Field(default_factory=dict)


def sanitize_text(text: str) -> str:
    """Removes null bytes and control characters while preserving formatting."""
    if not text:
        return ""
    # Strip null characters and invalid control chars (keeping \n, \t, \r)
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    # Normalize excessive carriage returns and trailing whitespace
    cleaned = re.sub(r"\r\n|\r", "\n", cleaned)
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def extract_text_from_pdf(file_bytes: bytes) -> List[tuple[int, str]]:
    """
    Extracts text per page from PDF bytes.
    Returns list of (page_number, text).
    """
    pages = []
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        for page_idx, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            text = sanitize_text(text)
            if text:
                pages.append((page_idx, text))
    except Exception as e:
        # Fallback raw extraction if pypdf fails
        raw = file_bytes.decode("utf-8", errors="ignore")
        cleaned = sanitize_text(raw)
        if cleaned:
            pages.append((1, cleaned))
    return pages if pages else [(1, "")]


def extract_text_from_docx(file_bytes: bytes) -> List[tuple[int, str]]:
    """
    Extracts paragraphs and headings from DOCX bytes.
    Returns list of (page_number_or_section, text).
    """
    try:
        import docx
        doc = docx.Document(io.BytesIO(file_bytes))
        lines = []
        for p in doc.paragraphs:
            text = p.text.strip()
            if not text:
                continue
            if p.style and "heading" in p.style.name.lower():
                lines.append(f"## {text}")
            else:
                lines.append(text)
        full_text = sanitize_text("\n\n".join(lines))
        return [(1, full_text)] if full_text else [(1, "")]
    except Exception:
        raw = file_bytes.decode("utf-8", errors="ignore")
        cleaned = sanitize_text(raw)
        return [(1, cleaned)]


def extract_text(file_bytes: bytes, filename: str) -> List[tuple[int, str]]:
    """Router for document parsing based on file extension."""
    ext = filename.lower().split(".")[-1] if "." in filename else ""
    if ext == "pdf":
        return extract_text_from_pdf(file_bytes)
    elif ext in ("docx", "doc"):
        return extract_text_from_docx(file_bytes)
    else:
        text = sanitize_text(file_bytes.decode("utf-8", errors="ignore"))
        return [(1, text)]


# Regex to detect section headers in Markdown, legal docs, policy standards
HEADING_PATTERN = re.compile(
    r"^(?:#{1,4}\s+(.+)|(?:Section|Chapter|Article|Policy|§)\s*[\d\.]*[:\s]+(.+)|[A-Z0-9\s]{4,40}:?$)",
    re.MULTILINE,
)


def approximate_tokens(text: str) -> int:
    """Fast approximation of token count (~4 characters per token or word count * 1.3)."""
    words = len(text.split())
    return max(1, int(words * 1.3))


def chunk_document(
    document_id: str,
    tenant_id: str,
    pages_or_sections: List[tuple[int, str]],
    target_token_size: int = 600,
    overlap_token_size: int = 100,
) -> List[DocumentChunk]:
    """
    Chunks extracted document text into ~500-800 tokens with overlap.
    Preserves section headings across chunks and annotates page numbers.
    """
    chunks: List[DocumentChunk] = []
    chunk_index = 0

    current_heading = "General Overview"

    for page_num, page_text in pages_or_sections:
        if not page_text.strip():
            continue

        paragraphs = page_text.split("\n\n")
        buffer_text = []
        buffer_tokens = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # Check if paragraph contains or begins with a section heading
            heading_match = HEADING_PATTERN.search(para)
            if heading_match:
                extracted = (heading_match.group(1) or heading_match.group(2) or heading_match.group(0)).strip()
                if len(extracted) > 2 and len(extracted) < 80:
                    current_heading = extracted

            para_tokens = approximate_tokens(para)

            # If adding this paragraph exceeds target size and we have buffered content
            if buffer_tokens + para_tokens > target_token_size and buffer_text:
                chunk_body = "\n\n".join(buffer_text)
                chunks.append(
                    DocumentChunk(
                        document_id=document_id,
                        tenant_id=tenant_id,
                        chunk_index=chunk_index,
                        section_heading=current_heading,
                        page_number=page_num,
                        content=chunk_body,
                        token_count=buffer_tokens,
                        metadata={
                            "page": page_num,
                            "heading": current_heading,
                            "tokens": buffer_tokens,
                        },
                    )
                )
                chunk_index += 1

                # Retain overlap from end of buffer
                overlap_text = []
                overlap_tokens = 0
                for item in reversed(buffer_text):
                    t_count = approximate_tokens(item)
                    if overlap_tokens + t_count <= overlap_token_size:
                        overlap_text.insert(0, item)
                        overlap_tokens += t_count
                    else:
                        break

                buffer_text = overlap_text + [para]
                buffer_tokens = overlap_tokens + para_tokens
            else:
                buffer_text.append(para)
                buffer_tokens += para_tokens

        # Flush remaining buffer
        if buffer_text:
            chunk_body = "\n\n".join(buffer_text)
            chunks.append(
                DocumentChunk(
                    document_id=document_id,
                    tenant_id=tenant_id,
                    chunk_index=chunk_index,
                    section_heading=current_heading,
                    page_number=page_num,
                    content=chunk_body,
                    token_count=buffer_tokens,
                    metadata={
                        "page": page_num,
                        "heading": current_heading,
                        "tokens": buffer_tokens,
                    },
                )
            )
            chunk_index += 1

    return chunks
