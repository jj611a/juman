"""Categories API tests."""

import pytest
from app.modules.categories.constants import CategoryPermission
from app.modules.rbac.constants import SystemRoleName
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token


@pytest.mark.asyncio
async def test_list_requires_auth(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/categories")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_crud_flow(admin_client: AsyncClient) -> None:
    created = await admin_client.post(
        "/api/v1/categories",
        json={
            "name_ar": "زفاف",
            "name_en": "Wedding",
            "description": "فساتين زفاف",
            "display_order": 10,
        },
    )
    assert created.status_code == 201, created.text
    category_id = created.json()["data"]["id"]
    assert created.json()["data"]["name_ar"] == "زفاف"

    listed = await admin_client.get("/api/v1/categories")
    assert listed.status_code == 200
    assert listed.json()["meta"]["total"] >= 1

    active = await admin_client.get("/api/v1/categories", params={"active_only": True})
    assert active.status_code == 200

    got = await admin_client.get(f"/api/v1/categories/{category_id}")
    assert got.status_code == 200

    patched = await admin_client.patch(
        f"/api/v1/categories/{category_id}",
        json={"display_order": 1, "name_en": "Bridal"},
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["display_order"] == 1
    assert patched.json()["data"]["name_en"] == "Bridal"

    deactivated = await admin_client.post(f"/api/v1/categories/{category_id}/deactivate")
    assert deactivated.status_code == 200
    assert deactivated.json()["data"]["is_active"] is False

    activated = await admin_client.post(f"/api/v1/categories/{category_id}/activate")
    assert activated.status_code == 200
    assert activated.json()["data"]["is_active"] is True

    searched = await admin_client.get(
        "/api/v1/categories",
        params={"q": "Bridal", "sort_by": "name_en", "sort_dir": "asc"},
    )
    assert searched.status_code == 200
    assert searched.json()["meta"]["total"] >= 1

    deleted = await admin_client.delete(f"/api/v1/categories/{category_id}")
    assert deleted.status_code == 200
    missing = await admin_client.get(f"/api/v1/categories/{category_id}")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_duplicate_name_conflict(admin_client: AsyncClient) -> None:
    first = await admin_client.post("/api/v1/categories", json={"name_ar": "مميز"})
    assert first.status_code == 201
    second = await admin_client.post("/api/v1/categories", json={"name_ar": "مميز"})
    assert second.status_code == 409


@pytest.mark.asyncio
async def test_create_validation_empty_name(admin_client: AsyncClient) -> None:
    response = await admin_client.post(
        "/api/v1/categories",
        json={"name_ar": "   "},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_cashier_forbidden(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    _, pair = await create_user_with_token(
        db_session,
        username="categories_cashier",
        role_name=SystemRoleName.CASHIER.value,
    )
    response = await api_client.get(
        "/api/v1/categories",
        headers=bearer_headers(pair.access_token),
    )
    assert response.status_code == 403
    assert response.json()["error"]["details"]["required_permission"] == (
        CategoryPermission.VIEW.value
    )


@pytest.mark.asyncio
async def test_inventory_can_view(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    _, pair = await create_user_with_token(
        db_session,
        username="categories_inventory",
        role_name=SystemRoleName.INVENTORY.value,
    )
    response = await api_client.get(
        "/api/v1/categories",
        headers=bearer_headers(pair.access_token),
    )
    assert response.status_code == 200
