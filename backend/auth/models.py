"""
Enterprise Multi-Tenant Authentication and RBAC models.
"""

from enum import Enum
import time
import uuid
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


class Role(str, Enum):
    ADMIN = "Admin"
    REVIEWER = "Reviewer"
    EDITOR = "Editor"
    VIEWER = "Viewer"


# Hierarchy: Admin > Reviewer > Editor > Viewer
ROLE_PERMISSIONS = {
    Role.ADMIN: ["read", "write", "comment", "review", "approve", "reject", "admin", "manage_webhooks"],
    Role.REVIEWER: ["read", "write", "comment", "review", "approve", "reject"],
    Role.EDITOR: ["read", "write", "comment", "submit_for_review"],
    Role.VIEWER: ["read"],
}


class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    avatar_url: Optional[str] = None
    provider: str = "local"  # 'google', 'microsoft', 'local'
    created_at: float = Field(default_factory=time.time)


class Organization(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str
    created_at: float = Field(default_factory=time.time)


class Membership(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    user_id: str
    role: Role = Role.EDITOR
    created_at: float = Field(default_factory=time.time)


class AuthenticatedUser(BaseModel):
    user_id: str
    email: str
    name: str
    avatar_url: Optional[str] = None
    tenant_id: str
    tenant_name: str
    role: Role
    permissions: List[str] = Field(default_factory=list)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AuthenticatedUser
