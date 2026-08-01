"""Audit admin API tests."""

from uuid import uuid4

import pytest
from app.modules.audit.constants import AuditAction, AuditPermission
from app.modules.audit.services.audit_log import AuditService
from app.modules.rbac.constants import SystemRoleName
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token


@pytest.mark.asyncio
async def test_list_requires_auth(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/audit/logs")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_and_get_flow(
    admin_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    service = AuditService(db_session)
    entity_id = uuid4()
    row = await service.record_update(
        module="settings",
        entity_type="Setting",
        entity_id=entity_id,
        old_values={"value": "a"},
        new_values={"value": "b"},
        username="audit_admin",
        ip_address="10.0.0.1",
        metadata={"source": "test"},
    )

    listed = await admin_client.get(
        "/api/v1/audit/logs",
        params={"module": "settings", "action": AuditAction.UPDATE.value},
    )
    assert listed.status_code == 200, listed.text
    body = listed.json()
    assert body["success"] is True
    assert body["meta"]["total"] >= 1
    assert body["data"][0]["entity_type"] == "Setting"
    assert body["data"][0]["old_values"] == {"value": "a"}
    assert body["data"][0]["metadata"] == {"source": "test"}

    got = await admin_client.get(f"/api/v1/audit/logs/{row.id}")
    assert got.status_code == 200
    assert got.json()["data"]["id"] == str(row.id)
    assert got.json()["data"]["ip_address"] == "10.0.0.1"

    missing = await admin_client.get(f"/api/v1/audit/logs/{uuid4()}")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_cashier_forbidden(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    _, pair = await create_user_with_token(
        db_session,
        username="audit_cashier",
        role_name=SystemRoleName.CASHIER.value,
    )
    response = await api_client.get(
        "/api/v1/audit/logs",
        headers=bearer_headers(pair.access_token),
    )
    assert response.status_code == 403
    assert response.json()["error"]["details"]["required_permission"] == (
        AuditPermission.VIEW.value
    )


@pytest.mark.asyncio
async def test_permission_seeded(admin_client: AsyncClient) -> None:
    response = await admin_client.get("/api/v1/permissions/by-key/audit.view")
    assert response.status_code == 200
    assert response.json()["item"]["key"] == "audit.view"
