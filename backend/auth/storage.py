"""
Multi-tenant user, organization, and membership storage with seed enterprise accounts.
"""

import json
import logging
import os
import threading
import time
from typing import Dict, List, Optional
from .models import AuthenticatedUser, Membership, Organization, Role, ROLE_PERMISSIONS, User

logger = logging.getLogger("brandguard.auth_storage")


class AuthStorage:
    def __init__(self, storage_path: str = "data/auth_store.json"):
        self.lock = threading.Lock()
        self.storage_path = storage_path
        self.orgs: Dict[str, Organization] = {}
        self.users: Dict[str, User] = {}
        self.memberships: Dict[str, Membership] = {}  # key: f"{tenant_id}:{user_id}"
        self._load_or_seed()

    def _load_or_seed(self):
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data.get("orgs", []):
                        o = Organization(**item)
                        self.orgs[o.id] = o
                    for item in data.get("users", []):
                        u = User(**item)
                        self.users[u.id] = u
                    for item in data.get("memberships", []):
                        m = Membership(**item)
                        self.memberships[f"{m.tenant_id}:{m.user_id}"] = m
                if self.orgs and self.users:
                    return
            except Exception as e:
                logger.warning(f"Error loading auth store: {e}")

        self._seed_default_enterprise()

    def _seed_default_enterprise(self):
        # 1. Organization: Acme CloudSync
        org = Organization(
            id="default-tenant",
            name="Acme CloudSync",
            slug="acme-cloudsync",
        )
        self.orgs[org.id] = org

        # 2. Seed Users across all 4 roles
        seed_users = [
            ("user-admin", "admin@acmecloudsync.com", "Sarah Chen", Role.ADMIN, "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah"),
            ("user-reviewer", "reviewer@acmecloudsync.com", "David Miller", Role.REVIEWER, "https://api.dicebear.com/7.x/avataaars/svg?seed=David"),
            ("user-editor", "editor@acmecloudsync.com", "Elena Rostova", Role.EDITOR, "https://api.dicebear.com/7.x/avataaars/svg?seed=Elena"),
            ("user-viewer", "viewer@acmecloudsync.com", "Alex Kumar", Role.VIEWER, "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex"),
        ]

        for uid, email, name, role, avatar in seed_users:
            u = User(id=uid, email=email, name=name, avatar_url=avatar, provider="google")
            self.users[u.id] = u
            mem = Membership(tenant_id=org.id, user_id=u.id, role=role)
            self.memberships[f"{org.id}:{u.id}"] = mem

        self._save()

    def _save(self):
        try:
            os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
            payload = {
                "orgs": [o.model_dump() for o in self.orgs.values()],
                "users": [u.model_dump() for u in self.users.values()],
                "memberships": [m.model_dump() for m in self.memberships.values()],
            }
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning(f"Failed to persist auth store: {e}")

    def get_user_by_email(self, email: str) -> Optional[User]:
        with self.lock:
            for u in self.users.values():
                if u.email.lower() == email.lower():
                    return u
            return None

    def get_or_create_oauth_user(
        self,
        email: str,
        name: str,
        provider: str = "google",
        avatar_url: Optional[str] = None,
        tenant_id: str = "default-tenant",
        default_role: Role = Role.EDITOR,
    ) -> AuthenticatedUser:
        with self.lock:
            u = None
            for existing in self.users.values():
                if existing.email.lower() == email.lower():
                    u = existing
                    break

            if not u:
                u = User(
                    email=email,
                    name=name,
                    avatar_url=avatar_url or f"https://api.dicebear.com/7.x/avataaars/svg?seed={name}",
                    provider=provider,
                )
                self.users[u.id] = u

            org = self.orgs.get(tenant_id)
            if not org:
                org = Organization(id=tenant_id, name="Acme CloudSync", slug=tenant_id)
                self.orgs[org.id] = org

            mem_key = f"{tenant_id}:{u.id}"
            mem = self.memberships.get(mem_key)
            if not mem:
                mem = Membership(tenant_id=tenant_id, user_id=u.id, role=default_role)
                self.memberships[mem_key] = mem

            self._save()

            return AuthenticatedUser(
                user_id=u.id,
                email=u.email,
                name=u.name,
                avatar_url=u.avatar_url,
                tenant_id=tenant_id,
                tenant_name=org.name,
                role=mem.role,
                permissions=ROLE_PERMISSIONS.get(mem.role, []),
            )

    def set_user_role(self, tenant_id: str, user_id: str, new_role: Role):
        with self.lock:
            mem_key = f"{tenant_id}:{user_id}"
            if mem_key in self.memberships:
                self.memberships[mem_key].role = new_role
                self._save()

    def get_authenticated_user(self, user_id: str, tenant_id: str = "default-tenant") -> Optional[AuthenticatedUser]:
        with self.lock:
            u = self.users.get(user_id)
            if not u:
                return None
            org = self.orgs.get(tenant_id)
            org_name = org.name if org else "Acme CloudSync"
            mem = self.memberships.get(f"{tenant_id}:{user_id}")
            role = mem.role if mem else Role.EDITOR
            return AuthenticatedUser(
                user_id=u.id,
                email=u.email,
                name=u.name,
                avatar_url=u.avatar_url,
                tenant_id=tenant_id,
                tenant_name=org_name,
                role=role,
                permissions=ROLE_PERMISSIONS.get(role, []),
            )

    def list_team_members(self, tenant_id: str = "default-tenant") -> List[AuthenticatedUser]:
        with self.lock:
            res = []
            org = self.orgs.get(tenant_id)
            org_name = org.name if org else "Acme CloudSync"
            for mem_key, mem in self.memberships.items():
                if mem.tenant_id == tenant_id:
                    u = self.users.get(mem.user_id)
                    if u:
                        res.append(
                            AuthenticatedUser(
                                user_id=u.id,
                                email=u.email,
                                name=u.name,
                                avatar_url=u.avatar_url,
                                tenant_id=tenant_id,
                                tenant_name=org_name,
                                role=mem.role,
                                permissions=ROLE_PERMISSIONS.get(mem.role, []),
                            )
                        )
            return res


auth_storage = AuthStorage()
