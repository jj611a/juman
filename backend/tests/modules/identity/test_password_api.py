"""Password API tests — Identity Phase 6."""

from datetime import timedelta

import pytest
from app.modules.identity.services.session import SessionService
from app.modules.identity.services.user import UserService
from app.modules.rbac.constants import SystemRoleName
from app.modules.rbac.services.role import RoleService
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.utils.datetime import utc_now
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


async def _token_for(
    db_session: AsyncSession,
    *,
    username: str,
    role_name: str,
    password: str = "Password1!",
    must_change_password: bool = False,
) -> tuple[object, str, object]:
    roles = RoleService(db_session)
    role = await roles.get_by_name(role_name)
    users = UserService(db_session)
    user = await users.create_user(
        username=username,
        password=password,
        full_name="Staff",
        role_id=role.id,
        must_change_password=must_change_password,
    )
    sessions = SessionService(db_session, settings=SettingService(db_session))
    login_session, pair = await sessions.create_session(user, record_login=False)
    return user, pair.access_token, login_session


@pytest.mark.asyncio
async def test_change_password_api(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    _, token, _ = await _token_for(
        db_session,
        username="api_chg",
        role_name=SystemRoleName.CASHIER.value,
    )
    response = await api_client.post(
        "/api/v1/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "Password1!", "new_password": "NewerPass1!"},
    )
    assert response.status_code == 200
    assert response.json()["success"] is True


@pytest.mark.asyncio
async def test_admin_reset_password_api(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    admin, admin_token, _ = await _token_for(
        db_session,
        username="api_admin_pw",
        role_name=SystemRoleName.ADMIN.value,
    )
    target, _, _ = await _token_for(
        db_session,
        username="api_target_pw",
        role_name=SystemRoleName.CASHIER.value,
    )
    response = await api_client.post(
        "/api/v1/admin/reset-password",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"user_id": str(target.id), "new_password": "AdminReset1!"},
    )
    assert response.status_code == 200

    # Cashier without users.manage cannot reset.
    _, cashier_token, _ = await _token_for(
        db_session,
        username="api_cashier_pw",
        role_name=SystemRoleName.CASHIER.value,
    )
    forbidden = await api_client.post(
        "/api/v1/admin/reset-password",
        headers={"Authorization": f"Bearer {cashier_token}"},
        json={"user_id": str(admin.id), "new_password": "AdminReset1!"},
    )
    assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_force_change_blocks_login_history_allows_change(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    user, token, _ = await _token_for(
        db_session,
        username="force_admin",
        role_name=SystemRoleName.ADMIN.value,
        must_change_password=True,
    )
    headers = {"Authorization": f"Bearer {token}"}

    blocked = await api_client.get("/api/v1/login-history", headers=headers)
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "password_change_required"

    sessions_ok = await api_client.get("/api/v1/sessions", headers=headers)
    assert sessions_ok.status_code == 200

    changed = await api_client.post(
        "/api/v1/change-password",
        headers=headers,
        json={"current_password": "Password1!", "new_password": "ForcedPass1!"},
    )
    assert changed.status_code == 200

    allowed = await api_client.get("/api/v1/login-history", headers=headers)
    assert allowed.status_code == 200


@pytest.mark.asyncio
async def test_expiry_gate(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    settings = SettingService(db_session)
    await settings.update_setting(SettingKey.PASSWORD_EXPIRE_DAYS.value, value=7)

    user, token, _ = await _token_for(
        db_session,
        username="exp_admin",
        role_name=SystemRoleName.ADMIN.value,
        must_change_password=False,
    )
    user.password_changed_at = utc_now() - timedelta(days=30)
    await db_session.flush()

    blocked = await api_client.get(
        "/api/v1/login-history",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "password_change_required"

    ok_change = await api_client.post(
        "/api/v1/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "Password1!", "new_password": "FreshPass1!"},
    )
    assert ok_change.status_code == 200
