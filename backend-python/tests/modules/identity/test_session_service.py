"""SessionService tests — Identity Phase 4."""

from datetime import timedelta

import pytest
from app.exceptions import AuthenticationError, NotFoundError
from app.modules.identity.repositories.refresh_token import RefreshTokenRepository
from app.modules.identity.services.session import SessionService
from app.modules.identity.services.user import UserService
from app.modules.rbac.constants import SystemRoleName
from app.modules.rbac.services.role import RoleService
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.utils.datetime import ensure_utc, utc_now
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
async def session_service(db_session: AsyncSession) -> SessionService:
    from tests.helpers.identity import seed_identity_basics

    await seed_identity_basics(db_session)
    return SessionService(db_session, settings=SettingService(db_session))


async def _create_cashier(
    db_session: AsyncSession,
    *,
    username: str = "cashier1",
):
    roles = RoleService(db_session)
    cashier = await roles.get_by_name(SystemRoleName.CASHIER.value)
    users = UserService(db_session)
    return await users.create_user(
        username=username,
        password="Password1!",
        full_name="Cashier",
        role_id=cashier.id,
        must_change_password=False,
    )


@pytest.mark.asyncio
async def test_create_session(
    session_service: SessionService,
    db_session: AsyncSession,
) -> None:
    user = await _create_cashier(db_session, username="sess1")
    login_session, pair = await session_service.create_session(
        user,
        device_name="Register-A",
        ip_address="10.0.0.5",
    )
    assert login_session.device_name == "Register-A"
    assert login_session.ip_address == "10.0.0.5"
    assert login_session.remember_me is False
    assert login_session.last_activity_at is not None
    assert pair.access_token
    assert pair.refresh_token

    active = await session_service.list_sessions(user.id)
    assert len(active) == 1
    assert active[0].id == login_session.id


@pytest.mark.asyncio
async def test_remember_me_longer_expiry(
    session_service: SessionService,
    db_session: AsyncSession,
) -> None:
    settings = SettingService(db_session)
    await settings.update_setting(SettingKey.REFRESH_TOKEN_EXPIRE_DAYS.value, value=7)
    await settings.update_setting(
        SettingKey.REMEMBER_ME_REFRESH_TOKEN_EXPIRE_DAYS.value,
        value=30,
    )
    user = await _create_cashier(db_session, username="remember1")
    normal, _ = await session_service.create_session(user, remember_me=False)
    remembered, _ = await session_service.create_session(user, remember_me=True)
    assert remembered.remember_me is True
    assert ensure_utc(remembered.expires_at) > ensure_utc(normal.expires_at)
    delta_days = (ensure_utc(remembered.expires_at) - utc_now()).total_seconds() / 86400
    assert delta_days > 20


@pytest.mark.asyncio
async def test_revoke_session(
    session_service: SessionService,
    db_session: AsyncSession,
) -> None:
    user = await _create_cashier(db_session, username="revsess")
    login_session, _ = await session_service.create_session(user)
    await session_service.revoke_session(
        login_session.id,
        actor_id=user.id,
        user_id=user.id,
    )
    assert await session_service.list_sessions(user.id) == []
    assert await RefreshTokenRepository(db_session).list_active_for_session(login_session.id) == []


@pytest.mark.asyncio
async def test_logout_all(
    session_service: SessionService,
    db_session: AsyncSession,
) -> None:
    user = await _create_cashier(db_session, username="logoutall")
    await session_service.create_session(user)
    await session_service.create_session(user)
    count = await session_service.logout_all(user.id, actor_id=user.id)
    assert count == 2
    assert await session_service.list_sessions(user.id) == []
    assert await RefreshTokenRepository(db_session).list_active_for_user(user.id) == []


@pytest.mark.asyncio
async def test_expired_session_rejected(
    session_service: SessionService,
    db_session: AsyncSession,
) -> None:
    user = await _create_cashier(db_session, username="expsess")
    login_session, _ = await session_service.create_session(user)
    login_session.expires_at = utc_now() - timedelta(seconds=1)
    await db_session.flush()

    with pytest.raises(AuthenticationError):
        await session_service.get_active(login_session.id)

    assert await session_service.list_sessions(user.id) == []


@pytest.mark.asyncio
async def test_revoke_other_users_session_not_found(
    session_service: SessionService,
    db_session: AsyncSession,
) -> None:
    owner = await _create_cashier(db_session, username="owner1")
    other = await _create_cashier(db_session, username="other1")
    login_session, _ = await session_service.create_session(owner)

    with pytest.raises(NotFoundError):
        await session_service.revoke_session(
            login_session.id,
            actor_id=other.id,
            user_id=other.id,
        )


@pytest.mark.asyncio
async def test_touch_updates_activity(
    session_service: SessionService,
    db_session: AsyncSession,
) -> None:
    user = await _create_cashier(db_session, username="touch1")
    login_session, _ = await session_service.create_session(user)
    login_session.last_activity_at = utc_now() - timedelta(minutes=5)
    await db_session.flush()
    before = ensure_utc(login_session.last_activity_at)

    touched = await session_service.touch(login_session.id)
    assert touched.last_activity_at is not None
    assert ensure_utc(touched.last_activity_at) >= before
