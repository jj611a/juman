"""Session HTTP API tests — Identity Phase 4."""

import pytest
from app.modules.identity.services.session import SessionService
from app.modules.identity.services.user import UserService
from app.modules.rbac.constants import SystemRoleName
from app.modules.rbac.services.role import RoleService
from app.modules.settings.services.setting import SettingService
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


async def _create_user_with_session(
    db_session: AsyncSession,
    *,
    username: str,
) -> tuple[object, object, str]:
    roles = RoleService(db_session)
    cashier = await roles.get_by_name(SystemRoleName.CASHIER.value)
    users = UserService(db_session)
    user = await users.create_user(
        username=username,
        password="Password1!",
        full_name="Cashier",
        role_id=cashier.id,
        must_change_password=False,
    )
    sessions = SessionService(db_session, settings=SettingService(db_session))
    login_session, pair = await sessions.create_session(
        user,
        device_name="API-POS",
        ip_address="192.168.1.10",
    )
    return user, login_session, pair.access_token


@pytest.mark.asyncio
async def test_list_sessions_requires_auth(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/sessions")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_and_revoke_session(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    _, login_session, token = await _create_user_with_session(
        db_session,
        username="api_sess1",
    )
    headers = {"Authorization": f"Bearer {token}"}

    listed = await api_client.get("/api/v1/sessions", headers=headers)
    assert listed.status_code == 200
    body = listed.json()
    assert body["success"] is True
    assert len(body["data"]) == 1
    assert body["data"][0]["id"] == str(login_session.id)
    assert body["data"][0]["is_current"] is True
    assert body["data"][0]["device_name"] == "API-POS"

    revoked = await api_client.delete(
        f"/api/v1/sessions/{login_session.id}",
        headers=headers,
    )
    assert revoked.status_code == 200

    again = await api_client.get("/api/v1/sessions", headers=headers)
    assert again.status_code == 401


@pytest.mark.asyncio
async def test_logout_all_sessions(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    user, _, token = await _create_user_with_session(db_session, username="api_all")
    sessions = SessionService(db_session, settings=SettingService(db_session))
    await sessions.create_session(user, device_name="Second")

    headers = {"Authorization": f"Bearer {token}"}
    listed = await api_client.get("/api/v1/sessions", headers=headers)
    assert len(listed.json()["data"]) == 2

    logout = await api_client.delete("/api/v1/sessions", headers=headers)
    assert logout.status_code == 200

    again = await api_client.get("/api/v1/sessions", headers=headers)
    assert again.status_code == 401


@pytest.mark.asyncio
async def test_cannot_revoke_another_users_session(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    _, victim_session, _ = await _create_user_with_session(db_session, username="victim")
    _, _, attacker_token = await _create_user_with_session(db_session, username="attacker")

    response = await api_client.delete(
        f"/api/v1/sessions/{victim_session.id}",
        headers={"Authorization": f"Bearer {attacker_token}"},
    )
    assert response.status_code == 404
