"""
Threaded Inline Review Comments anchored to text ranges.
Supports adding anchored comments, replying, and resolving/reopening threads.
"""

import json
import logging
import os
import threading
import time
import uuid
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger("brandguard.comments")


class CommentReply(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    author_id: str
    author_name: str
    author_role: str
    comment: str
    created_at: float = Field(default_factory=time.time)


class InlineComment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    draft_id: str
    author_id: str
    author_name: str
    author_role: str
    start_offset: int
    end_offset: int
    selected_text: str
    comment: str
    resolved: bool = False
    resolved_by: Optional[str] = None
    replies: List[CommentReply] = Field(default_factory=list)
    created_at: float = Field(default_factory=time.time)


class CommentStore:
    def __init__(self, storage_path: str = "data/comments_store.json"):
        self.lock = threading.Lock()
        self.storage_path = storage_path
        # Map: comment_id -> InlineComment
        self.comments: Dict[str, InlineComment] = {}
        self._load()

    def _load(self):
        if not os.path.exists(self.storage_path):
            return
        try:
            with open(self.storage_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data:
                    c = InlineComment(**item)
                    self.comments[c.id] = c
        except Exception as e:
            logger.warning(f"Error loading comments: {e}")

    def _save(self):
        try:
            os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump(
                    [c.model_dump() for c in self.comments.values()],
                    f,
                    ensure_ascii=False,
                    indent=2,
                )
        except Exception as e:
            logger.warning(f"Failed to persist comments: {e}")

    def get_comments(self, tenant_id: str, draft_id: str) -> List[InlineComment]:
        with self.lock:
            items = [
                c
                for c in self.comments.values()
                if c.tenant_id == tenant_id and c.draft_id == draft_id
            ]
            return sorted(items, key=lambda x: x.created_at)

    def add_comment(
        self,
        tenant_id: str,
        draft_id: str,
        author_id: str,
        author_name: str,
        author_role: str,
        start_offset: int,
        end_offset: int,
        selected_text: str,
        comment: str,
    ) -> InlineComment:
        with self.lock:
            c = InlineComment(
                tenant_id=tenant_id,
                draft_id=draft_id,
                author_id=author_id,
                author_name=author_name,
                author_role=author_role,
                start_offset=start_offset,
                end_offset=end_offset,
                selected_text=selected_text,
                comment=comment,
            )
            self.comments[c.id] = c
            self._save()
            return c

    def add_reply(
        self,
        tenant_id: str,
        comment_id: str,
        author_id: str,
        author_name: str,
        author_role: str,
        reply_text: str,
    ) -> Optional[InlineComment]:
        with self.lock:
            c = self.comments.get(comment_id)
            if not c or c.tenant_id != tenant_id:
                return None
            reply = CommentReply(
                author_id=author_id,
                author_name=author_name,
                author_role=author_role,
                comment=reply_text,
            )
            c.replies.append(reply)
            self._save()
            return c

    def toggle_resolve(self, tenant_id: str, comment_id: str, user_name: str) -> Optional[InlineComment]:
        with self.lock:
            c = self.comments.get(comment_id)
            if not c or c.tenant_id != tenant_id:
                return None
            c.resolved = not c.resolved
            c.resolved_by = user_name if c.resolved else None
            self._save()
            return c


comment_store = CommentStore()
