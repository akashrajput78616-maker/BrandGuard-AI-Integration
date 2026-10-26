"""
Enterprise Audit Logging.
Maintains an immutable, chronological record of all review actions, edits, approval decisions,
and administrative operations scoped per tenant.
"""

import json
import logging
import os
import threading
import time
import uuid
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger("brandguard.audit")


class AuditEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    user_id: str
    user_name: str
    user_role: str
    action: str
    resource_type: str  # 'draft', 'document', 'comment', 'webhook', 'auth'
    resource_id: str
    details: dict = Field(default_factory=dict)
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
                    for item in data:
                        self.logs.append(AuditEntry(**item))
                if self.logs:
                    return
            except Exception as e:
                logger.warning(f"Error loading audit store: {e}")

        # Seed initial enterprise audit records
        initial_events = [
            ("user-admin", "Sarah Chen", "Admin", "workspace_initialized", "organization", "default-tenant", {"msg": "Acme CloudSync workspace configured with RAG policies"}),
            ("user-editor", "Elena Rostova", "Editor", "draft_created", "draft", "draft-1", {"title": "Product launch announcement"}),
            ("user-editor", "Elena Rostova", "Editor", "review_requested", "draft", "draft-1", {"status": "In Review"}),
            ("user-reviewer", "David Miller", "Reviewer", "comment_added", "comment", "comment-seed", {"quote": "guarantees zero data loss", "note": "Needs third-party citation"}),
        ]
        for uid, uname, urole, act, rtype, rid, details in initial_events:
            self.logs.append(
                AuditEntry(
                    tenant_id="default-tenant",
                    user_id=uid,
                    user_name=uname,
                    user_role=urole,
                    action=act,
                    resource_type=rtype,
                    resource_id=rid,
                    details=details,
                )
            )
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
            entry = AuditEntry(
                tenant_id=tenant_id,
                user_id=user_id,
                user_name=user_name,
                user_role=user_role,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                details=details or {},
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


audit_store = AuditLogStore()
