"""
Unit tests for enterprise authentication, JWT tokens, RBAC permission guards,
and approval state machine.
"""

import pytest
from fastapi import HTTPException
from auth.jwt_handler import (
    create_access_token,
    create_refresh_token,
    decode_token,
    require_roles,
)
from auth.models import AuthenticatedUser, Role, ROLE_PERMISSIONS
from collab.approvals import DraftStore
from collab.audit import AuditLogStore


@pytest.fixture
def test_user_admin():
    return AuthenticatedUser(
        user_id="user-1",
        email="admin@test.com",
        name="Admin Test",
        tenant_id="tenant-1",
        tenant_name="Test Org",
        role=Role.ADMIN,
        permissions=ROLE_PERMISSIONS[Role.ADMIN],
    )


@pytest.fixture
def test_user_editor():
    return AuthenticatedUser(
        user_id="user-2",
        email="editor@test.com",
        name="Editor Test",
        tenant_id="tenant-1",
        tenant_name="Test Org",
        role=Role.EDITOR,
        permissions=ROLE_PERMISSIONS[Role.EDITOR],
    )


@pytest.fixture
def test_user_viewer():
    return AuthenticatedUser(
        user_id="user-3",
        email="viewer@test.com",
        name="Viewer Test",
        tenant_id="tenant-1",
        tenant_name="Test Org",
        role=Role.VIEWER,
        permissions=ROLE_PERMISSIONS[Role.VIEWER],
    )


def test_jwt_access_and_refresh_cycle(test_user_admin):
    access_token = create_access_token(test_user_admin)
    refresh_token = create_refresh_token(test_user_admin)

    decoded_access = decode_token(access_token, expected_type="access")
    assert decoded_access["sub"] == test_user_admin.user_id
    assert decoded_access["role"] == "Admin"
    assert decoded_access["tenant_id"] == "tenant-1"

    decoded_refresh = decode_token(refresh_token, expected_type="refresh")
    assert decoded_refresh["sub"] == test_user_admin.user_id
    assert decoded_refresh["type"] == "refresh"


def test_rbac_guard_blocks_unauthorized_roles(test_user_editor):
    admin_only_guard = require_roles([Role.ADMIN])
    # Editor attempting to access admin-only endpoint should raise 403
    with pytest.raises(HTTPException) as excinfo:
        admin_only_guard(test_user_editor)
    assert excinfo.value.status_code == 403
    assert "Forbidden" in excinfo.value.detail


def test_approval_state_machine_rbac(tmp_path, test_user_editor, test_user_viewer):
    store_file = str(tmp_path / "test_drafts.json")
    store = DraftStore(storage_path=store_file)

    draft = store.create_draft(
        tenant_id="tenant-1",
        title="Launch Brief",
        content="Testing content",
        created_by="user-2",
    )
    assert draft.status == "Draft"

    # Editor can submit for review
    updated = store.transition_status(
        draft_id=draft.id,
        tenant_id="tenant-1",
        target_status="In Review",
        user_id=test_user_editor.user_id,
        user_name=test_user_editor.name,
        user_role=test_user_editor.role,
    )
    assert updated.status == "In Review"

    # Editor CANNOT approve (must raise 403)
    with pytest.raises(HTTPException) as exc:
        store.transition_status(
            draft_id=draft.id,
            tenant_id="tenant-1",
            target_status="Approved",
            user_id=test_user_editor.user_id,
            user_name=test_user_editor.name,
            user_role=test_user_editor.role,
        )
    assert exc.value.status_code == 403

    # Viewer CANNOT edit content
    with pytest.raises(HTTPException) as exc:
        store.update_draft_content(
            draft_id=draft.id,
            tenant_id="tenant-1",
            content="Viewer trying to edit",
            user_role=test_user_viewer.role,
        )
    assert exc.value.status_code == 403


def test_audit_log_recording(tmp_path):
    store_file = str(tmp_path / "test_audit.json")
    audit = AuditLogStore(storage_path=store_file)

    audit.log(
        tenant_id="tenant-x",
        user_id="u-1",
        user_name="Jane",
        user_role="Reviewer",
        action="approved_draft",
        resource_type="draft",
        resource_id="d-100",
        details={"note": "Looks great"},
    )

    logs = audit.query("tenant-x")
    assert len(logs) == 1
    assert logs[0].action == "approved_draft"
    assert logs[0].user_name == "Jane"
