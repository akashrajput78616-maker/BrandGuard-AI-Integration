"""
Seed enterprise brand guideline documents for BrandGuard RAG knowledge base.
"""

import logging
from .ingestion import IngestionManager

logger = logging.getLogger("brandguard.seed")

DEFAULT_ACME_GUIDELINES = """# Acme CloudSync Brand Governance & Communications Policy (v3.2)

## Section 1: Claims & Substantiation Policy (§3.2)
All marketing communications, sales copy, landing pages, and customer collateral must adhere strictly to substantiated claims.
1.1 Absolute Superlatives: Never make absolute superiority claims (such as "the world's fastest backup tool", "the fastest syncing engine on the market", or "unmatched speed") without citing third-party certified benchmark test results published within the last 12 months.
1.2 Zero Data Loss Guarantees: Do not guarantee zero data loss. State instead: "engineered for 99.999% durability with multi-region redundancy and continuous encrypted backup".
1.3 Unlimited Storage: Plans have defined storage tiers and quotas. Never advertise "unlimited storage" without clearly qualifying Fair Use terms.

## Section 2: Approved Terminology Standards (§2.1)
Consistent terminology reinforces trust and category positioning.
2.1 Product Category: Always refer to the product category as "cloud backup" or "cloud synchronization". The informal phrase "cloud storage thing" is strictly banned across all public materials.
2.2 Official Product Name: Refer to the solution as "Acme CloudSync" on first mention in any document or page. Subsequent references may use "CloudSync".
2.3 Security Nomenclature: Use "zero-knowledge client-side encryption" or "AES-256 military-grade encryption" rather than vague phrases like "super safe lock".

## Section 3: Voice, Tone & Style Standards (§1.4)
3.1 Brand Personality: Confident, helpful, clear, and reassuring. We treat data protection with professional gravitas.
3.2 Punctuation & Shouting: Avoid aggressive hype, shouting in all caps (such as "STOP EVERYTHING!!!"), and repetitive exclamation marks. Limit exclamation points to at most one per marketing email or hero message.
3.3 Slang & Superlatives: Avoid colloquial buzzwords like "literally the BEST thing EVER".

## Section 4: Approved Factual Statements (§2.4)
Only the following performance and architecture statements are approved for marketing publication:
4.1 "Acme CloudSync provides scheduled automatic syncing and continuous version history."
4.2 "Enterprise customers benefit from SOC-2 Type II certified data centers and GDPR compliance."
4.3 "File recovery supports rollback to any point in the past 30 days."

## Section 5: Accessibility & Visual Media Standards (§4.1)
5.1 Image Alt-Text: Every informative graphic, screenshot, diagram, or banner must include descriptive alternative text describing the key information shown.
5.2 Color Contrast: All user interface and marketing text overlays must maintain a minimum contrast ratio of 4.5:1 against image backgrounds (WCAG 2.1 Level AA) for standard text, and 3:1 for large display headers (18pt+ or bold 14pt+).
5.3 Logo Usage: The approved Acme CloudSync mark must always retain its 1:1 aspect ratio and must never be recolored, distorted, or cropped within 20px of clear space.
"""


def seed_guidelines_if_empty(ingestion_mgr: IngestionManager, tenant_id: str = "default-tenant"):
    """Seeds default enterprise brand guidelines if the tenant has no documents."""
    docs = ingestion_mgr.list_documents(tenant_id)
    if not docs:
        logger.info(f"Seeding default Acme brand guidelines for tenant {tenant_id}...")
        doc = ingestion_mgr.register_document(
            filename="Acme_CloudSync_Brand_Guidelines_v3.2.pdf",
            file_bytes=DEFAULT_ACME_GUIDELINES.encode("utf-8"),
            tenant_id=tenant_id,
        )
        ingestion_mgr.process_document(doc.id)
        logger.info(f"Successfully seeded and indexed {doc.filename}")
