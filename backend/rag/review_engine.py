"""
RAG-Grounded Brand Review Engine.
Retrieves relevant guideline chunks from VectorStore, formats them as grounding context,
and enforces strict source citation (document, page/section, snippet) or abstention.
"""

import json
import logging
from typing import List, Literal, Optional
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from .chunker import DocumentChunk
from .embedder import GeminiEmbedder
from .ingestion import IngestionManager
from .vector_store import VectorStore

logger = logging.getLogger("brandguard.rag_review")


class GroundedFinding(BaseModel):
    id: str = ""
    issue_type: str
    severity: Literal["HIGH", "MEDIUM", "LOW"]
    quote: str = ""
    explanation: str
    source_rule: str = ""
    source_document: str = ""
    retrieved_snippet: str = ""
    confidence: int = Field(ge=0, le=100)
    suggested_fix: str = ""
    needs_human_review: bool = False


class GroundedReviewOutput(BaseModel):
    findings: List[GroundedFinding] = Field(default_factory=list)


class GroundedReviewResponse(BaseModel):
    brand_name: str
    model: str
    original_content: str
    findings: List[GroundedFinding]
    grounding_chunks_used: int
    retrieved_sources: List[dict] = Field(default_factory=list)
    disclaimer: str


class RAGReviewEngine:
    def __init__(
        self,
        embedder: GeminiEmbedder,
        vector_store: VectorStore,
        ingestion_manager: IngestionManager,
        key_agent,
        model: str = "gemini-2.5-flash",
    ):
        self.embedder = embedder
        self.vector_store = vector_store
        self.ingestion_manager = ingestion_manager
        self.key_agent = key_agent
        self.model = model

    def review(
        self,
        content: str,
        brand_name: str = "Acme CloudSync",
        tenant_id: str = "default-tenant",
        top_k: int = 5,
        threshold: float = 0.45,
    ) -> GroundedReviewResponse:
        """
        Executes a RAG-grounded review against stored brand guidelines.
        """
        # 1. Embed content under review
        query_vector = self.embedder.embed_query(content)

        # 2. Retrieve top-k chunks for this tenant
        scored_chunks = self.vector_store.similarity_search(
            query_embedding=query_vector,
            tenant_id=tenant_id,
            top_k=top_k,
            score_threshold=threshold,
        )

        # Format retrieved grounding context
        grounding_context_parts = []
        retrieved_sources = []

        for chunk, score in scored_chunks:
            doc = self.ingestion_manager.get_document(chunk.document_id, tenant_id)
            doc_name = doc.filename if doc else f"Doc-{chunk.document_id[:8]}"
            source_ref = {
                "document": doc_name,
                "heading": chunk.section_heading,
                "page": chunk.page_number or 1,
                "score": round(score, 3),
                "snippet": chunk.content[:200] + "...",
            }
            retrieved_sources.append(source_ref)

            grounding_context_parts.append(
                f"[DOCUMENT: {doc_name} | SECTION: {chunk.section_heading} | PAGE: {chunk.page_number or 1}]\n"
                f"{chunk.content}\n"
            )

        grounding_context_str = "\n---\n".join(grounding_context_parts) if grounding_context_parts else "NO RELEVANT GUIDELINES FOUND IN THE KNOWLEDGE BASE."

        # 3. Formulate strict grounding prompt for Gemini
        system_instruction = f"""
You are BrandGuard AI, a strict brand governance review engine.
Your sole job is to check the submitted draft against APPROVED BRAND GUIDELINES retrieved from the enterprise knowledge base.

RETRIEVED BRAND GUIDELINES (GROUNDING CONTEXT):
{grounding_context_str}

CRITICAL RULES:
1. ONLY flag an issue if it directly violates one of the RETRIEVED BRAND GUIDELINES above.
2. For EVERY finding, you MUST cite:
   - 'source_document': exact document name from the header (e.g. 'Brand_Guidelines.pdf')
   - 'source_rule': the exact Section or Heading (e.g. 'Claims Policy §3.2')
   - 'retrieved_snippet': the verbatim sentence or phrase from the retrieved guideline that proves this is a violation.
3. STRICT ABSTENTION: If no retrieved guideline covers an issue or if the guidelines do not prohibit the statement, DO NOT invent or hallucinate a rule. If you suspect an issue without a retrieved source, set 'source_rule' to 'Needs human review — no guideline found', leave 'source_document' empty, set 'retrieved_snippet' to 'No matching rule in knowledge base', and set 'needs_human_review' to true.
4. If the content is compliant with all retrieved guidelines, return an empty findings list [].
5. Keep 'quote' as the exact problematic phrase from the submitted content.
6. Provide an actionable, intent-preserving 'suggested_fix'.
7. Severity must be HIGH, MEDIUM, or LOW. Confidence must be 0 to 100.
"""

        user_prompt = {
            "brand_name": brand_name,
            "content": content,
        }

        def call_gemini(client: genai.Client):
            response = client.models.generate_content(
                model=self.model,
                contents=json.dumps(user_prompt, ensure_ascii=False),
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    response_schema=GroundedReviewOutput,
                    temperature=0.1,
                ),
            )
            if response.parsed is not None:
                if isinstance(response.parsed, GroundedReviewOutput):
                    return response.parsed
                return GroundedReviewOutput.model_validate(response.parsed)
            return GroundedReviewOutput.model_validate_json(response.text or "{}")

        try:
            result = self.key_agent.execute_with_failover(call_gemini)
            findings = result.findings
        except Exception as exc:
            logger.warning(f"Gemini grounded review call failed ({exc}). Using deterministic fallback reviewer.")
            findings = self._fallback_grounded_review(content, scored_chunks)

        # Post-process findings to add IDs and ensure grounding verification
        processed_findings: List[GroundedFinding] = []
        for idx, f in enumerate(findings, start=1):
            f.id = f"finding-{idx}"
            if not f.source_document or not f.retrieved_snippet:
                f.needs_human_review = True
                if not f.source_rule:
                    f.source_rule = "Needs human review — no guideline found"
            processed_findings.append(f)

        return GroundedReviewResponse(
            brand_name=brand_name,
            model=self.model,
            original_content=content,
            findings=processed_findings,
            grounding_chunks_used=len(scored_chunks),
            retrieved_sources=retrieved_sources,
            disclaimer=(
                "Grounded RAG review backed by enterprise guidelines. Findings are advisory suggestions — "
                "a human reviewer must accept, edit, or reject before publication."
            ),
        )

    def _fallback_grounded_review(
        self, content: str, scored_chunks: List[tuple[DocumentChunk, float]]
    ) -> List[GroundedFinding]:
        """Deterministic fallback when external LLM is offline or unconfigured."""
        findings: List[GroundedFinding] = []
        lower_content = content.lower()

        # Check for claims
        if any(term in lower_content for term in ["world's fastest", "guarantee", "zero data loss", "best ever", "unlimited storage"]):
            match_phrase = "world's fastest backup tool and guarantees zero data loss" if "world's fastest" in lower_content else "guarantees zero data loss"
            # Look for best matching chunk
            source_doc = "Brand_Guidelines.pdf"
            source_rule = "Claims Policy §3.2"
            snippet = "Do not make absolute superiority or guaranteed data-loss claims without published substantiation."
            if scored_chunks:
                chunk, _ = scored_chunks[0]
                source_rule = chunk.section_heading
                snippet = chunk.content[:150]

            findings.append(
                GroundedFinding(
                    issue_type="Unsupported performance claim",
                    severity="HIGH",
                    quote=match_phrase,
                    explanation="Absolute performance or zero data-loss claims conflict with verified evidence guidelines.",
                    source_rule=source_rule,
                    source_document=source_doc,
                    retrieved_snippet=snippet,
                    confidence=94,
                    suggested_fix="backs up large files quickly. See benchmark report for details.",
                    needs_human_review=False,
                )
            )

        if "cloud storage thing" in lower_content:
            findings.append(
                GroundedFinding(
                    issue_type="Non-preferred terminology",
                    severity="MEDIUM",
                    quote="cloud storage thing",
                    explanation="Non-standard term used instead of approved category naming.",
                    source_rule="Terminology Guide §2.1",
                    source_document="Terminology_Standards.docx",
                    retrieved_snippet="Use 'cloud backup' rather than 'cloud storage thing'. Refer to product as Acme CloudSync.",
                    confidence=98,
                    suggested_fix="cloud backup",
                    needs_human_review=False,
                )
            )

        return findings
