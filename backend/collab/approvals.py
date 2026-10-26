"""
Role-based approval queues and draft state machine.
Enforces server-side permissions:
- Draft -> In Review: Editor, Reviewer, Admin
- In Review -> Approved: Reviewer, Admin
- In Review -> Rejected: Reviewer, Admin
"""

import json
import logging
import os
import threading
import time
import uuid
from typing import Dict, List, Optional
from fastapi import HTTPException, status
from pydantic import BaseModel, Field

from auth.models import Role

logger = logging.getLogger("brandguard.approvals")


class Draft(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    title: str
    content: str
    status: str = "Draft"  # Draft, In Review, Approved, Rejected
    created_by: str
    assigned_to: Optional[str] = None
    version: int = 1
    rejection_reason: Optional[str] = None
    approved_by: Optional[str] = None
    updated_at: float = Field(default_factory=time.time)
    created_at: float = Field(default_factory=time.time)


class DraftStore:
    def __init__(self, storage_path: str = "data/drafts_store.json"):
        self.lock = threading.Lock()
        self.storage_path = storage_path
        self.drafts: Dict[str, Draft] = {}
        self._load_or_seed()

    def _load_or_seed(self):
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data:
                        d = Draft(**item)
                        self.drafts[d.id] = d
                if self.drafts:
                    return
            except Exception as e:
                logger.warning(f"Error loading drafts: {e}")

        # Seed initial sample drafts for default-tenant
        initial_samples = [
            ("draft-1", "Product launch announcement", "Acme CloudSync is the world's fastest backup tool and guarantees zero data loss.", "In Review"),
            ("draft-2", "Social campaign / October", "STOP EVERYTHING!!! Our cloud storage thing is literally the BEST thing EVER!!!", "Draft"),
            ("draft-3", "Feature overview", "Acme CloudSync gives every customer unlimited storage and guaranteed recovery. Back up your work with confidence.", "Draft"),
            ("draft-4", "Enterprise Security Brief", "Acme CloudSync supports continuous version history and client-side encryption.", "Approved"),
        ]
        for did, title, content, stat in initial_samples:
            d = Draft(
                id=did,
                tenant_id="default-tenant",
                title=title,
                content=content,
                status=stat,
                created_by="user-editor",
            )
            self.drafts[d.id] = d
        self._save()

    def _save(self):
        try:
            os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump([d.model_dump() for d in self.drafts.values()], f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning(f"Failed to persist drafts: {e}")

    def list_drafts(self, tenant_id: str) -> List[Draft]:
        with self.lock:
            return sorted(
                [d for d in self.drafts.values() if d.tenant_id == tenant_id],
                key=lambda x: x.updated_at,
                reverse=True,
            )

    def get_draft(self, draft_id: str, tenant_id: str) -> Optional[Draft]:
        with self.lock:
            d = self.drafts.get(draft_id)
            if d and d.tenant_id == tenant_id:
                return d
            return None

    def create_draft(self, tenant_id: str, title: str, content: str, created_by: str) -> Draft:
        with self.lock:
            d = Draft(
                tenant_id=tenant_id,
                title=title,
                content=content,
                created_by=created_by,
                status="Draft",
            )
            self.drafts[d.id] = d
            self._save()
            return d

    def update_draft_content(self, draft_id: str, tenant_id: str, content: str, user_role: Role) -> Draft:
        if user_role == Role.VIEWER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Viewers cannot edit draft content",
            )
        with self.lock:
            d = self.drafts.get(draft_id)
            if not d or d.tenant_id != tenant_id:
                raise HTTPException(status_code=404, detail="Draft not found")
            d.content = content
            d.version += 1
            d.updated_at = time.time()
            self._save()
            return d

    def transition_status(
        self,
        draft_id: str,
        tenant_id: str,
        target_status: str,
        user_id: str,
        user_name: str,
        user_role: Role,
        reason: Optional[str] = None,
    ) -> Draft:
        """
        State transitions with strict server-side RBAC validation:
        - 'In Review': requires Editor, Reviewer, or Admin
        - 'Approved': requires Reviewer or Admin
        - 'Rejected': requires Reviewer or Admin
        """
        valid_statuses = ["Draft", "In Review", "Approved", "Rejected"]
        if target_status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid target status: {target_status}")

        if target_status in ("Approved", "Rejected") and user_role not in (Role.REVIEWER, Role.ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission Denied: Only Reviewers or Admins can approve or reject drafts. Your role: {user_role.value}",
            )

        if target_status == "In Review" and user_role == Role.VIEWER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Viewers cannot submit drafts for review.",
            )

        with self.lock:
            d = self.drafts.get(draft_id)
            if not d or d.tenant_id != tenant_id:
                raise HTTPException(status_code=404, detail="Draft not found")

            d.status = target_status
            d.updated_at = time.time()
            if target_status == "Approved":
                d.approved_by = user_name
                d.rejection_reason = None
            elif target_status == "Rejected":
                d.rejection_reason = reason or "Policy violations require revision"
                d.approved_by = None

            self._save()
            return d


draft_store = DraftStore()
