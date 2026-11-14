"""
API Key Management and Integration Service.
Allows generating and managing scoped API keys for programmatic access,
Google Docs Add-on sidebar integrations, and automated publishing pipelines.
"""

import hashlib
import json
import logging
import os
import secrets
import threading
import time
import uuid
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger("brandguard.api_keys")


class APIKey(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = "default-tenant"
    name: str
    prefix: str
    hashed_secret: str
    scope: str = "creator"  # 'admin', 'approver', 'reviewer', 'creator'
    created_by: str = "admin"
    created_at: float = Field(default_factory=time.time)
    last_used_at: Optional[float] = None
    revoked: bool = False


class APIKeyStore:
    def __init__(self, storage_path: str = "data/api_keys_store.json"):
        self.lock = threading.Lock()
        self.storage_path = storage_path
        self.keys: Dict[str, APIKey] = {}
        self._load_or_seed()

    def _load_or_seed(self):
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data:
                        k = APIKey(**item)
                        self.keys[k.id] = k
                if self.keys:
                    return
            except Exception as e:
                logger.warning(f"Error loading API keys: {e}")

        # Seed initial demo API keys
        sample_keys = [
            ("key-01", "Google Docs Add-on (Acme Marketing)", "bg_live_gdocs", "reviewer"),
            ("key-02", "CI/CD Content Linter GitHub Action", "bg_live_github", "creator"),
            ("key-03", "Enterprise Slack Bot Integration", "bg_live_slack", "approver"),
        ]
        now = time.time()
        for kid, name, prefix, scope in sample_keys:
            raw_hash = hashlib.sha256(f"secret-{kid}".encode()).hexdigest()
            self.keys[kid] = APIKey(
                id=kid,
                tenant_id="default-tenant",
                name=name,
                prefix=f"{prefix[:10]}...",
                hashed_secret=raw_hash,
                scope=scope,
                created_at=now - 14 * 86400,
                last_used_at=now - 3600,
            )
        self._save()

    def _save(self):
        try:
            os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump([k.model_dump() for k in self.keys.values()], f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning(f"Failed to persist API keys: {e}")

    def list_keys(self, tenant_id: str) -> List[dict]:
        with self.lock:
            items = [k for k in self.keys.values() if k.tenant_id == tenant_id]
            items.sort(key=lambda x: x.created_at, reverse=True)
            return [
                {
                    "id": k.id,
                    "name": k.name,
                    "prefix": k.prefix,
                    "scope": k.scope,
                    "created_at": k.created_at,
                    "last_used_at": k.last_used_at,
                    "revoked": k.revoked,
                }
                for k in items
            ]

    def create_key(self, tenant_id: str, name: str, scope: str = "creator") -> dict:
        with self.lock:
            raw_secret = f"bg_live_{secrets.token_urlsafe(24)}"
            prefix = raw_secret[:12] + "..."
            hashed = hashlib.sha256(raw_secret.encode()).hexdigest()
            
            k = APIKey(
                tenant_id=tenant_id,
                name=name,
                prefix=prefix,
                hashed_secret=hashed,
                scope=scope,
            )
            self.keys[k.id] = k
            self._save()

            return {
                "id": k.id,
                "name": k.name,
                "secret": raw_secret,  # Shown only once!
                "prefix": k.prefix,
                "scope": k.scope,
                "created_at": k.created_at,
            }

    def revoke_key(self, key_id: str, tenant_id: str) -> bool:
        with self.lock:
            if key_id in self.keys and self.keys[key_id].tenant_id == tenant_id:
                self.keys[key_id].revoked = True
                self._save()
                return True
            return False


api_key_store = APIKeyStore()
