"""API authorization and smoke tests for System Administration."""

import pytest
from app.modules.rbac.constants import SystemRoleName
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token


@pytest.mark.asyncio
async def test_info_requires_auth(api_client: AsyncClient):
    response = await api_client.get("/api/v1/system/info")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_info_forbidden_for_cashier(api_client: AsyncClient, db_session: AsyncSession):
    _, pair = await create_user_with_token(
        db_session, username="sys_cashier", role_name=SystemRoleName.CASHIER.value
    )
    response = await api_client.get(
        "/api/v1/system/info",
        headers=bearer_headers(pair.access_token),
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_info_ok_admin(admin_client: AsyncClient):
    response = await admin_client.get("/api/v1/system/info")
    assert response.status_code == 200
    body = response.json()
    assert body["app_name"] == "Juman"
    assert body["api_version"] == "v1"
    assert "environment" in body
    blob = str(body).lower()
    assert "password" not in blob
    assert "secret_key" not in blob
    assert "postgresql+asyncpg://" not in blob


@pytest.mark.asyncio
async def test_diagnostics_ok_admin(admin_client: AsyncClient):
    response = await admin_client.get("/api/v1/system/diagnostics")
    assert response.status_code == 200
    body = response.json()
    assert body["overall"] in {"ok", "degraded", "down"}
    assert len(body["checks"]) >= 12


@pytest.mark.asyncio
async def test_maintenance_tasks_list(admin_client: AsyncClient):
    response = await admin_client.get("/api/v1/system/maintenance/tasks")
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 7
    assert all(item["phase"] == "current" for item in items)
    assert all("category" in item for item in items)
    assert any(item["id"] == "cleanup_sessions" for item in items)


@pytest.mark.asyncio
async def test_public_health_unchanged(api_client: AsyncClient):
    response = await api_client.get("/api/v1/health")
    assert response.status_code == 200
    assert "status" in response.json()


@pytest.mark.asyncio
async def test_public_version_unchanged(api_client: AsyncClient):
    response = await api_client.get("/api/v1/version")
    assert response.status_code == 200
    assert "version" in response.json()
