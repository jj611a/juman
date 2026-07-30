"""Identity Users API tests."""

import pytest
from app.modules.rbac.constants import SystemRoleName
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token


@pytest.mark.asyncio
async def test_users_require_auth(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/users")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_user_crud_flow(admin_client: AsyncClient) -> None:
    roles = await admin_client.get("/api/v1/roles")
    assert roles.status_code == 200
    cashier = next(item for item in roles.json()["items"] if item["name"] == SystemRoleName.CASHIER)

    created = await admin_client.post(
        "/api/v1/users",
        json={
            "username": "apiuser1",
            "password": "Password1!",
            "full_name": "API User",
            "role_id": cashier["id"],
            "email": "api@example.com",
            "phone": "+9647701112233",
        },
    )
    assert created.status_code == 201, created.text
    user_id = created.json()["data"]["id"]
    assert created.json()["data"]["username"] == "apiuser1"
    assert "password_hash" not in created.json()["data"]

    listed = await admin_client.get("/api/v1/users")
    assert listed.status_code == 200
    assert listed.json()["meta"]["total"] >= 1

    got = await admin_client.get(f"/api/v1/users/{user_id}")
    assert got.status_code == 200

    patched = await admin_client.patch(
        f"/api/v1/users/{user_id}",
        json={"full_name": "API User 2"},
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["full_name"] == "API User 2"

    deactivated = await admin_client.post(f"/api/v1/users/{user_id}/deactivate")
    assert deactivated.status_code == 200
    assert deactivated.json()["data"]["is_active"] is False

    activated = await admin_client.post(f"/api/v1/users/{user_id}/activate")
    assert activated.status_code == 200
    assert activated.json()["data"]["is_active"] is True

    deleted = await admin_client.delete(f"/api/v1/users/{user_id}")
    assert deleted.status_code == 200
    missing = await admin_client.get(f"/api/v1/users/{user_id}")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_create_validation_errors(admin_client: AsyncClient) -> None:
    roles = await admin_client.get("/api/v1/roles")
    cashier = next(item for item in roles.json()["items"] if item["name"] == SystemRoleName.CASHIER)

    bad_username = await admin_client.post(
        "/api/v1/users",
        json={
            "username": "ab",
            "password": "Password1!",
            "full_name": "X",
            "role_id": cashier["id"],
        },
    )
    assert bad_username.status_code == 422

    bad_email = await admin_client.post(
        "/api/v1/users",
        json={
            "username": "okuser",
            "password": "Password1!",
            "full_name": "X",
            "role_id": cashier["id"],
            "email": "not-email",
        },
    )
    assert bad_email.status_code == 422


@pytest.mark.asyncio
async def test_cashier_forbidden_on_users(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    _, pair = await create_user_with_token(
        db_session,
        username="users_cashier",
        role_name=SystemRoleName.CASHIER.value,
    )
    response = await api_client.get(
        "/api/v1/users",
        headers=bearer_headers(pair.access_token),
    )
    assert response.status_code == 403
