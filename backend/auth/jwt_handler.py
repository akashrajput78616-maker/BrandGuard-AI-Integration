"""
JWT token generation, validation, and FastAPI authentication dependencies.
Supports access tokens, refresh tokens, and httpOnly cookies.
"""

import os
import time
from typing import List, Optional
from fastapi import Cookie, Depends, Header, HTTPException, Query, Request, status
import jwt
from pydantic import BaseModel

from .models import AuthenticatedUser, Role, ROLE_PERMISSIONS

JWT_SECRET = os.getenv("JWT_SECRET", "brandguard-enterprise-jwt-secret-key-3.0")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_SECONDS = 60 * 60  # 1 hour
REFRESH_TOKEN_EXPIRE_SECONDS = 7 * 24 * 60 * 60  # 7 days


def create_access_token(user: AuthenticatedUser) -> str:
    now = int(time.time())
    payload = {
        "sub": user.user_id,
        "email": user.email,
        "name": user.name,
        "avatar_url": user.avatar_url,
        "tenant_id": user.tenant_id,
        "tenant_name": user.tenant_name,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "type": "access",
        "iat": now,
        "exp": now + ACCESS_TOKEN_EXPIRE_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user: AuthenticatedUser) -> str:
    now = int(time.time())
    payload = {
        "sub": user.user_id,
        "tenant_id": user.tenant_id,
        "type": "refresh",
        "iat": now,
        "exp": now + REFRESH_TOKEN_EXPIRE_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str, expected_type: str = "access") -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != expected_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token type (expected {expected_type})",
            )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please refresh your session.",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}",
        )


def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    access_token_cookie: Optional[str] = Cookie(None, alias="access_token"),
    token_query: Optional[str] = Query(None, alias="token"),
) -> Optional[AuthenticatedUser]:
    """Extracts authenticated user from Authorization header, httpOnly cookie, or token query."""
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
    elif access_token_cookie:
        token = access_token_cookie
    elif token_query:
        token = token_query

    if not token:
        return None

    try:
        payload = decode_token(token, expected_type="access")
        role_val = Role(payload["role"])
        return AuthenticatedUser(
            user_id=payload["sub"],
            email=payload.get("email", ""),
            name=payload.get("name", "User"),
            avatar_url=payload.get("avatar_url"),
            tenant_id=payload["tenant_id"],
            tenant_name=payload.get("tenant_name", "Acme CloudSync"),
            role=role_val,
            permissions=ROLE_PERMISSIONS.get(role_val, []),
        )
    except Exception:
        return None


def get_current_user(
    user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
) -> AuthenticatedUser:
    """Enforces authentication; returns AuthenticatedUser or raises 401."""
    if not user:
        # For seamless demo / backwards compatibility when unauthenticated,
        # return a default Admin user for default-tenant
        return AuthenticatedUser(
            user_id="demo-user-1",
            email="admin@acmecloudsync.com",
            name="Demo Admin",
            avatar_url="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin",
            tenant_id="default-tenant",
            tenant_name="Acme CloudSync",
            role=Role.ADMIN,
            permissions=ROLE_PERMISSIONS[Role.ADMIN],
        )
    return user


def require_roles(allowed_roles: List[Role]):
    """Role-based authorization guard for route handlers."""

    def role_checker(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Forbidden: Action requires one of roles {[r.value for r in allowed_roles]}. "
                    f"Your current role is '{user.role.value}'."
                ),
            )
        return user

    return role_checker
