"""API and dependency tests for RBAC."""

import pytest
from app.modules.rbac.constants import SystemRoleName
from app.modules.rbac.dependencies import (
    require_all_permissions,
    require_any_permission,
    require_permission,
)
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token


@pytest.mark.asyncio
async def test_list_permissions_requires_auth(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/permissions")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_permissions(admin_client: AsyncClient) -> None:
    response = await admin_client.get("/api/v1/permissions")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["total"] >= 50
    keys = {item["key"] for item in body["items"]}
    assert "inventory.view" in keys
    assert "roles.manage" in keys


@pytest.mark.asyncio
async def test_get_permission_by_key(admin_client: AsyncClient) -> None:
    response = await admin_client.get("/api/v1/permissions/by-key/settings.update")
    assert response.status_code == 200
    assert response.json()["item"]["key"] == "settings.update"


@pytest.mark.asyncio
async def test_list_roles_includes_system_roles(admin_client: AsyncClient) -> None:
    response = await admin_client.get("/api/v1/roles")
    assert response.status_code == 200
    names = {item["name"] for item in response.json()["items"]}
    assert SystemRoleName.ADMIN in names
    assert SystemRoleName.CASHIER in names


@pytest.mark.asyncio
async def test_create_role_and_assign_permissions(admin_client: AsyncClient) -> None:
    create = await admin_client.post(
        "/api/v1/roles",
        json={
            "name": "Supervisor",
            "description": "مشرف",
            "permission_keys": ["reports.view", "calendar.view"],
        },
    )
    assert create.status_code == 201
    role_id = create.json()["item"]["id"]
    permission_keys = {p["key"] for p in create.json()["item"]["permissions"]}
    assert "reports.view" in permission_keys

    listed = await admin_client.get(f"/api/v1/roles/{role_id}/permissions")
    assert listed.status_code == 200
    assert listed.json()["total"] == 2

    assign = await admin_client.post(
        f"/api/v1/roles/{role_id}/permissions",
        json={"permission_keys": ["inventory.view"]},
    )
    assert assign.status_code == 200
    assert assign.json()["total"] == 3


@pytest.mark.asyncio
async def test_create_permission(admin_client: AsyncClient) -> None:
    response = await admin_client.post(
        "/api/v1/permissions",
        json={
            "key": "demo.special",
            "display_name": "صلاحية تجريبية",
            "description": "للاختبار",
        },
    )
    assert response.status_code == 201
    assert response.json()["item"]["module"] == "demo"


@pytest.mark.asyncio
async def test_delete_system_role_forbidden(admin_client: AsyncClient) -> None:
    roles = await admin_client.get("/api/v1/roles")
    admin = next(item for item in roles.json()["items"] if item["name"] == SystemRoleName.ADMIN)
    response = await admin_client.delete(f"/api/v1/roles/{admin['id']}")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_cashier_forbidden_on_roles(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    _, pair = await create_user_with_token(
        db_session,
        username="rbac_cashier",
        role_name=SystemRoleName.CASHIER.value,
    )
    response = await api_client.get(
        "/api/v1/roles",
        headers=bearer_headers(pair.access_token),
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_require_permission_helpers_enforce_role_permissions() -> None:
    from unittest.mock import AsyncMock, MagicMock

    from app.exceptions import AuthorizationError
    from app.modules.identity.schemas.session import AuthenticatedPrincipal

    principal = AuthenticatedPrincipal(user=MagicMock(role_id="role-1"), session_id=MagicMock())
    roles = AsyncMock()
    roles.role_has_permission = AsyncMock(return_value=False)

    with pytest.raises(AuthorizationError):
        await require_permission("inventory.view")(principal=principal, roles=roles)

    with pytest.raises(AuthorizationError):
        await require_any_permission("inventory.view", "reports.view")(
            principal=principal,
            roles=roles,
        )

    with pytest.raises(AuthorizationError):
        await require_all_permissions("inventory.view", "inventory.create")(
            principal=principal,
            roles=roles,
        )

    roles.role_has_permission = AsyncMock(return_value=True)
    allowed = await require_permission("inventory.view")(principal=principal, roles=roles)
    assert allowed is principal
