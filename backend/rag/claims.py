"""
Claims Ledger with Expiration Tracking.
Allows organizations to record approved promotional claims, substantiation evidence,
and expiration dates to detect outdated or expired brand claims.
"""

import json
import logging
import os
import threading
import time
import uuid
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger("brandguard.claims")


class Claim(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = "default-tenant"
    text: str
    category: str = "Performance"  # Performance, Security, Market Leadership, Environmental
    evidence: str
    source_document: str = "Brand Guidelines v3.2"
    expires_at: Optional[float] = None  # Unix timestamp
    created_at: float = Field(default_factory=time.time)

    @property
    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return time.time() > self.expires_at


class ClaimStore:
    def __init__(self, storage_path: str = "data/claims_store.json"):
        self.lock = threading.Lock()
        self.storage_path = storage_path
        self.claims: Dict[str, Claim] = {}
        self._load_or_seed()

    def _load_or_seed(self):
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data:
                        c = Claim(**item)
                        self.claims[c.id] = c
                if self.claims:
                    return
            except Exception as e:
                logger.warning(f"Error loading claims: {e}")

        # Seed initial claims: some active, some intentionally expired for demo detection
        now = time.time()
        one_year_ago = now - 365 * 86400
        six_months_ahead = now + 180 * 86400

        seeded = [
            (
                "claim-1",
                "Acme CloudSync supports client-side AES-256 encryption for all enterprise tiers.",
                "Security",
                "ISO/IEC 27001 Certification report §4.2",
                "Security Whitepaper 2026",
                six_months_ahead,
            ),
            (
                "claim-2",
                "Rated #1 in cloud sync throughput in the 2025 TechBenchmarks Annual Speed Report.",
                "Performance",
                "TechBenchmarks independent review (Report #TB-2025-08)",
                "Annual Benchmark 2025",
                one_year_ago,  # Expired claim!
            ),
            (
                "claim-3",
                "99.99% service uptime across US and EU availability zones.",
                "Reliability",
                "Quarterly SLA Attestation Q3 2026",
                "Uptime Attestation",
                six_months_ahead,
            ),
            (
                "claim-4",
                "Guaranteed zero data loss recovery under all catastrophic storage failures.",
                "Performance",
                "Substantiation rejected: Absolute guarantee unprovable under disaster conditions.",
                "Claims Policy §3.2",
                one_year_ago,  # Prohibited / expired claim!
            ),
        ]

        for cid, text, cat, ev, doc, exp in seeded:
            self.claims[cid] = Claim(
                id=cid,
                tenant_id="default-tenant",
                text=text,
                category=cat,
                evidence=ev,
                source_document=doc,
                expires_at=exp,
                created_at=now - 30 * 86400,
            )
        self._save()

    def _save(self):
        try:
            os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump([c.model_dump() for c in self.claims.values()], f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning(f"Failed to persist claims: {e}")

    def list_claims(self, tenant_id: str) -> List[dict]:
        with self.lock:
            items = [c for c in self.claims.values() if c.tenant_id == tenant_id]
            items.sort(key=lambda x: x.created_at, reverse=True)
            return [
                {
                    **c.model_dump(),
                    "is_expired": c.is_expired,
                }
                for c in items
            ]

    def add_claim(
        self,
        tenant_id: str,
        text: str,
        category: str,
        evidence: str,
        source_document: str,
        expires_at: Optional[float] = None,
    ) -> Claim:
        with self.lock:
            c = Claim(
                tenant_id=tenant_id,
                text=text,
                category=category,
                evidence=evidence,
                source_document=source_document,
                expires_at=expires_at,
            )
            self.claims[c.id] = c
            self._save()
            return c

    def delete_claim(self, claim_id: str, tenant_id: str) -> bool:
        with self.lock:
            if claim_id in self.claims and self.claims[claim_id].tenant_id == tenant_id:
                del self.claims[claim_id]
                self._save()
                return True
            return False


claim_store = ClaimStore()
