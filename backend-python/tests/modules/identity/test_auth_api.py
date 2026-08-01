"""Auth HTTP API tests — Identity Phase 7."""

import pytest
from app.modules.identity.services.user import UserService
from app.modules.rbac.constants import SystemRoleName
from app.modules.rbac.services.role import RoleService
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token
from tests.helpers.identity import ADMIN_PASSWORD


async def _create_login_user(
    db_session: AsyncSession,
    *,
    username: str,
    password: str = "Password1!",
    role_name: str = SystemRoleName.CASHIER.value,
    must_change_password: bool = False,
):
    roles = RoleService(db_session)
    role = await roles.get_by_name(role_name)
    users = UserService(db_session)
    return await users.create_user(
        username=username,
        password=password,
        full_name="Login User",
        role_id=role.id,
        must_change_password=must_change_password,
    )


@pytest.mark.asyncio
async def test_login_success(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    await _create_login_user(db_session, username="login_ok", password="Password1!")
    response = await api_client.post(
        "/api/v1/login",
        json={
            "username": "login_ok",
            "password": "Password1!",
            "remember_me": False,
            "device_name": "pytest",
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["access_token"]
    assert data["refresh_token"]
    assert data["token_type"] == "bearer"
    assert data["session_id"]
    assert data["user"]["username"] == "login_ok"


@pytest.mark.asyncio
async def test_login_failure_generic(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    await _create_login_user(db_session, username="login_bad")
    response = await api_client.post(
        "/api/v1/login",
        json={"username": "login_bad", "password": "WrongPass1!"},
    )
    assert response.status_code == 401
    body = response.json()
    assert "failure_reason" not in body
    assert body["error"]["message"] == "اسم المستخدم أو كلمة المرور غير صحيحة"


@pytest.mark.asyncio
async def test_login_lockout(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    settings = SettingService(db_session)
    await settings.update_setting(SettingKey.MAX_FAILED_LOGIN_ATTEMPTS.value, value=2)
    await settings.update_setting(SettingKey.ACCOUNT_LOCK_DURATION_MINUTES.value, value=30)
    await _create_login_user(db_session, username="login_lock")

    for _ in range(2):
        bad = await api_client.post(
            "/api/v1/login",
            json={"username": "login_lock", "password": "WrongPass1!"},
        )
        assert bad.status_code == 401

    locked = await api_client.post(
        "/api/v1/login",
        json={"username": "login_lock", "password": "Password1!"},
    )
    assert locked.status_code == 401
    assert locked.json()["error"]["message"] == "اسم المستخدم أو كلمة المرور غير صحيحة"


@pytest.mark.asyncio
async def test_refresh_rotation_and_reuse(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    await _create_login_user(db_session, username="refresh_user")
    login = await api_client.post(
        "/api/v1/login",
        json={"username": "refresh_user", "password": "Password1!"},
    )
    old_refresh = login.json()["data"]["refresh_token"]

    rotated = await api_client.post(
        "/api/v1/refresh",
        json={"refresh_token": old_refresh},
    )
    assert rotated.status_code == 200, rotated.text
    new_refresh = rotated.json()["data"]["refresh_token"]
    assert new_refresh != old_refresh

    reuse = await api_client.post(
        "/api/v1/refresh",
        json={"refresh_token": old_refresh},
    )
    assert reuse.status_code == 401


@pytest.mark.asyncio
async def test_logout_invalidates_bearer(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    await _create_login_user(db_session, username="logout_user")
    login = await api_client.post(
        "/api/v1/login",
        json={"username": "logout_user", "password": "Password1!"},
    )
    token = login.json()["data"]["access_token"]
    headers = bearer_headers(token)

    me = await api_client.get("/api/v1/me", headers=headers)
    assert me.status_code == 200

    logout = await api_client.post("/api/v1/logout", headers=headers)
    assert logout.status_code == 200

    after = await api_client.get("/api/v1/me", headers=headers)
    assert after.status_code == 401


@pytest.mark.asyncio
async def test_logout_all_invalidates_sessions(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    await _create_login_user(db_session, username="logout_all_user")
    first = await api_client.post(
        "/api/v1/login",
        json={"username": "logout_all_user", "password": "Password1!"},
    )
    second = await api_client.post(
        "/api/v1/login",
        json={"username": "logout_all_user", "password": "Password1!"},
    )
    t1 = first.json()["data"]["access_token"]
    t2 = second.json()["data"]["access_token"]

    done = await api_client.post("/api/v1/logout-all", headers=bearer_headers(t1))
    assert done.status_code == 200

    assert (await api_client.get("/api/v1/me", headers=bearer_headers(t1))).status_code == 401
    assert (await api_client.get("/api/v1/me", headers=bearer_headers(t2))).status_code == 401


@pytest.mark.asyncio
async def test_me_get_and_patch(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    await _create_login_user(db_session, username="me_user")
    login = await api_client.post(
        "/api/v1/login",
        json={"username": "me_user", "password": "Password1!"},
    )
    headers = bearer_headers(login.json()["data"]["access_token"])

    got = await api_client.get("/api/v1/me", headers=headers)
    assert got.status_code == 200
    assert got.json()["data"]["username"] == "me_user"

    patched = await api_client.patch(
        "/api/v1/me",
        headers=headers,
        json={"full_name": "Updated Name", "phone": "+9647700000001"},
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["full_name"] == "Updated Name"


@pytest.mark.asyncio
async def test_force_change_allows_me_get_and_logout_blocks_patch(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    user, pair = await create_user_with_token(
        db_session,
        username="force_me",
        role_name=SystemRoleName.ADMIN.value,
        must_change_password=True,
        password=ADMIN_PASSWORD,
    )
    headers = bearer_headers(pair.access_token)

    me_ok = await api_client.get("/api/v1/me", headers=headers)
    assert me_ok.status_code == 200

    patch_blocked = await api_client.patch(
        "/api/v1/me",
        headers=headers,
        json={"full_name": "Blocked"},
    )
    assert patch_blocked.status_code == 403
    assert patch_blocked.json()["error"]["code"] == "password_change_required"

    settings_blocked = await api_client.get("/api/v1/settings", headers=headers)
    assert settings_blocked.status_code == 403

    logout_ok = await api_client.post("/api/v1/logout", headers=headers)
    assert logout_ok.status_code == 200
    assert user.username == "force_me"
