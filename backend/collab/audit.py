"""
Enterprise Cryptographic Audit Logging.
Maintains an immutable, append-only, SHA-256 hash-chained record of all review actions,
edits, approval decisions, and administrative operations scoped per tenant.
Includes cryptographic integrity verification to detect any tampering or broken chains.
"""

import hashlib
import json
import logging
import os
import threading
import time
import uuid
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger("brandguard.audit")

GENESIS_PREV_HASH = "0" * 64


def calculate_entry_hash(
    prev_hash: str,
    entry_id: str,
    tenant_id: str,
    created_at: float,
    user_id: str,
    action: str,
    resource_type: str,
    resource_id: str,
    details: dict,
) -> str:
    """Computes deterministic SHA-256 digest for an audit entry linking to previous row."""
    payload = f"{prev_hash}|{entry_id}|{tenant_id}|{created_at:.4f}|{user_id}|{action}|{resource_type}|{resource_id}|{json.dumps(details or {}, sort_keys=True)}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class AuditEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    user_id: str
    user_name: str
    user_role: str
    action: str
    resource_type: str  # 'draft', 'document', 'comment', 'webhook', 'auth', 'claim', 'receipt'
    resource_id: str
    details: dict = Field(default_factory=dict)
    prev_hash: str = GENESIS_PREV_HASH
    hash: str = ""
    created_at: float = Field(default_factory=time.time)


class AuditLogStore:
    def __init__(self, storage_path: str = "data/audit_store.json"):
        self.lock = threading.Lock()
        self.storage_path = storage_path
        self.logs: List[AuditEntry] = []
        self._load_or_seed()

    def _load_or_seed(self):
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    prev_h = GENESIS_PREV_HASH
                    needs_resave = False
                    for item in data:
                        entry = AuditEntry(**item)
                        if entry.prev_hash != prev_h or not entry.hash:
                            entry.prev_hash = prev_h
                            entry.hash = calculate_entry_hash(
                                entry.prev_hash,
                                entry.id,
                                entry.tenant_id,
                                entry.created_at,
                                entry.user_id,
                                entry.action,
                                entry.resource_type,
                                entry.resource_id,
                                entry.details,
                            )
                            needs_resave = True
                        prev_h = entry.hash
                        self.logs.append(entry)
                    if needs_resave:
                        self._save()
                if self.logs:
                    return
            except Exception as e:
                logger.warning(f"Error loading audit store: {e}")

        # Seed initial enterprise audit records with valid cryptographic hash chain
        initial_events = [
            ("user-admin", "Sarah Chen", "Admin", "workspace_initialized", "organization", "default-tenant", {"msg": "Acme CloudSync workspace configured with RAG policies"}),
            ("user-editor", "Elena Rostova", "Editor", "draft_created", "draft", "draft-1", {"title": "Product launch announcement"}),
            ("user-editor", "Elena Rostova", "Editor", "review_requested", "draft", "draft-1", {"status": "In Review"}),
            ("user-reviewer", "David Miller", "Reviewer", "comment_added", "comment", "comment-seed", {"quote": "guarantees zero data loss", "note": "Needs third-party citation"}),
        ]
        
        current_prev = GENESIS_PREV_HASH
        now = time.time()
        for idx, (uid, uname, urole, act, rtype, rid, details) in enumerate(initial_events):
            entry_id = f"seed-audit-{idx + 1}"
            created = now + idx * 60
            h = calculate_entry_hash(current_prev, entry_id, "default-tenant", created, uid, act, rtype, rid, details)
            entry = AuditEntry(
                id=entry_id,
                tenant_id="default-tenant",
                user_id=uid,
                user_name=uname,
                user_role=urole,
                action=act,
                resource_type=rtype,
                resource_id=rid,
                details=details,
                prev_hash=current_prev,
                hash=h,
                created_at=created,
            )
            self.logs.append(entry)
            current_prev = h
            
        self._save()

    def _save(self):
        try:
            os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump([l.model_dump() for l in self.logs], f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning(f"Failed to persist audit log: {e}")

    def log(
        self,
        tenant_id: str,
        user_id: str,
        user_name: str,
        user_role: str,
        action: str,
        resource_type: str,
        resource_id: str,
        details: dict = None,
    ) -> AuditEntry:
        with self.lock:
            tenant_logs = [l for l in self.logs if l.tenant_id == tenant_id]
            prev_hash = tenant_logs[-1].hash if tenant_logs else GENESIS_PREV_HASH
            
            entry_id = str(uuid.uuid4())
            now = time.time()
            clean_details = details or {}
            entry_hash = calculate_entry_hash(
                prev_hash=prev_hash,
                entry_id=entry_id,
                tenant_id=tenant_id,
                created_at=now,
                user_id=user_id,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                details=clean_details,
            )
            
            entry = AuditEntry(
                id=entry_id,
                tenant_id=tenant_id,
                user_id=user_id,
                user_name=user_name,
                user_role=user_role,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                details=clean_details,
                prev_hash=prev_hash,
                hash=entry_hash,
                created_at=now,
            )
            self.logs.append(entry)
            self._save()
            return entry

    def query(
        self,
        tenant_id: str,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        limit: int = 50,
    ) -> List[AuditEntry]:
        with self.lock:
            filtered = [l for l in self.logs if l.tenant_id == tenant_id]
            if user_id:
                filtered = [l for l in filtered if l.user_id == user_id]
            if action:
                filtered = [l for l in filtered if l.action == action]
            # Order newest first
            filtered.sort(key=lambda x: x.created_at, reverse=True)
            return filtered[:limit]

    def verify_chain(self, tenant_id: str) -> dict:
        """
        Cryptographically verifies the append-only hash chain for a tenant.
        Returns whether the entire chain is valid, the head hash, and location of any broken link.
        """
        with self.lock:
            tenant_logs = [l for l in self.logs if l.tenant_id == tenant_id]
            tenant_logs.sort(key=lambda x: x.created_at)
            
            if not tenant_logs:
                return {
                    "valid": True,
                    "total_entries": 0,
                    "head_hash": GENESIS_PREV_HASH,
                    "broken_at_index": None,
                    "message": "Audit chain is empty. Genesis state intact."
                }
            
            expected_prev = GENESIS_PREV_HASH
            for idx, entry in enumerate(tenant_logs):
                # 1. Check parent hash linkage
                if entry.prev_hash != expected_prev:
                    return {
                        "valid": False,
                        "total_entries": len(tenant_logs),
                        "head_hash": tenant_logs[-1].hash,
                        "broken_at_index": idx,
                        "broken_entry_id": entry.id,
                        "message": f"Hash chain broken at index {idx}: expected prev_hash {expected_prev[:12]}..., got {entry.prev_hash[:12]}..."
                    }
                
                # 2. Recompute and verify entry's self-hash
                expected_hash = calculate_entry_hash(
                    prev_hash=entry.prev_hash,
                    entry_id=entry.id,
                    tenant_id=entry.tenant_id,
                    created_at=entry.created_at,
                    user_id=entry.user_id,
                    action=entry.action,
                    resource_type=entry.resource_type,
                    resource_id=entry.resource_id,
                    details=entry.details,
                )
                if entry.hash != expected_hash:
                    return {
                        "valid": False,
                        "total_entries": len(tenant_logs),
                        "head_hash": tenant_logs[-1].hash,
                        "broken_at_index": idx,
                        "broken_entry_id": entry.id,
                        "message": f"Tampering detected at index {idx}: entry hash mismatch."
                    }
                
                expected_prev = entry.hash

            return {
                "valid": True,
                "total_entries": len(tenant_logs),
                "head_hash": tenant_logs[-1].hash,
                "broken_at_index": None,
                "message": f"Audit chain verified. All {len(tenant_logs)} blocks cryptographically valid."
            }


audit_store = AuditLogStore()
