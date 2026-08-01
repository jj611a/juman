"""Login history HTTP API tests — Identity Phase 5."""

import pytest
from app.modules.identity.constants import IdentityPermission
from app.modules.identity.services.session import SessionService
from app.modules.identity.services.user import UserService
from app.modules.rbac.constants import SystemRoleName
from app.modules.rbac.services.role import RoleService
from app.modules.settings.services.setting import SettingService
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


async def _create_user_with_token(
    db_session: AsyncSession,
    *,
    username: str,
    role_name: str,
) -> tuple[object, str]:
    roles = RoleService(db_session)
    role = await roles.get_by_name(role_name)
    users = UserService(db_session)
    user = await users.create_user(
        username=username,
        password="Password1!",
        full_name="Staff",
        role_id=role.id,
        must_change_password=False,
    )
    sessions = SessionService(db_session, settings=SettingService(db_session))
    _, pair = await sessions.create_session(user, record_login=True)
    return user, pair.access_token


@pytest.mark.asyncio
async def test_login_history_requires_auth(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/login-history")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_history_forbidden_for_cashier(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    _, token = await _create_user_with_token(
        db_session,
        username="hist_cashier",
        role_name=SystemRoleName.CASHIER.value,
    )
    response = await api_client.get(
        "/api/v1/login-history",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
    assert response.json()["error"]["details"]["required_permission"] == (
        IdentityPermission.USERS_VIEW_LOGIN_HISTORY.value
    )


@pytest.mark.asyncio
async def test_login_history_allowed_for_admin(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    admin, token = await _create_user_with_token(
        db_session,
        username="hist_admin",
        role_name=SystemRoleName.ADMIN.value,
    )
    headers = {"Authorization": f"Bearer {token}"}

    listed = await api_client.get("/api/v1/login-history", headers=headers)
    assert listed.status_code == 200
    body = listed.json()
    assert body["success"] is True
    assert "meta" in body
    assert body["meta"]["total"] >= 1

    filtered = await api_client.get(
        "/api/v1/login-history",
        headers=headers,
        params={"event_type": "login", "success": "true", "limit": 5},
    )
    assert filtered.status_code == 200
    assert filtered.json()["meta"]["limit"] == 5

    by_user = await api_client.get(
        f"/api/v1/users/{admin.id}/login-history",
        headers=headers,
    )
    assert by_user.status_code == 200
    assert by_user.json()["meta"]["total"] >= 1
    assert all(row["user_id"] == str(admin.id) for row in by_user.json()["data"])


@pytest.mark.asyncio
async def test_login_history_search_and_pagination(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    admin, token = await _create_user_with_token(
        db_session,
        username="page_admin",
        role_name=SystemRoleName.ADMIN.value,
    )
    other, _ = await _create_user_with_token(
        db_session,
        username="page_other",
        role_name=SystemRoleName.CASHIER.value,
    )
    headers = {"Authorization": f"Bearer {token}"}

    searched = await api_client.get(
        "/api/v1/login-history",
        headers=headers,
        params={"q": "page_other"},
    )
    assert searched.status_code == 200
    assert searched.json()["meta"]["total"] >= 1
    assert all("page_other" in row["username_attempted"] for row in searched.json()["data"])

    page = await api_client.get(
        "/api/v1/login-history",
        headers=headers,
        params={"offset": 0, "limit": 1},
    )
    assert page.status_code == 200
    assert len(page.json()["data"]) == 1
    assert page.json()["meta"]["total"] >= 2

    scoped = await api_client.get(
        f"/api/v1/users/{other.id}/login-history",
        headers=headers,
        params={"event_type": "login"},
    )
    assert scoped.status_code == 200
    assert all(row["user_id"] == str(other.id) for row in scoped.json()["data"])
