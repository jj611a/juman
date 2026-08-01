"""PasswordService tests — Identity Phase 6."""

from datetime import timedelta

import pytest
from app.exceptions import AuthenticationError, ValidationError
from app.modules.identity.services.password import PasswordService
from app.modules.identity.services.session import SessionService
from app.modules.identity.services.user import UserService
from app.modules.rbac.constants import SystemRoleName
from app.modules.rbac.services.role import RoleService
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.utils.datetime import utc_now
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
async def password_service(db_session: AsyncSession) -> PasswordService:
    from tests.helpers.identity import seed_identity_basics

    await seed_identity_basics(db_session)
    return PasswordService(db_session, settings=SettingService(db_session))


async def _create_user(
    db_session: AsyncSession,
    *,
    username: str = "pwuser",
    password: str = "Password1!",
    must_change_password: bool = False,
):
    roles = RoleService(db_session)
    role = await roles.get_by_name(SystemRoleName.CASHIER.value)
    users = UserService(db_session)
    return await users.create_user(
        username=username,
        password=password,
        full_name="Staff",
        role_id=role.id,
        must_change_password=must_change_password,
    )


@pytest.mark.asyncio
async def test_complexity_and_min_length(
    password_service: PasswordService,
    db_session: AsyncSession,
) -> None:
    settings = SettingService(db_session)
    await settings.update_setting(SettingKey.PASSWORD_MIN_LENGTH.value, value=10)
    await settings.update_setting(SettingKey.PASSWORD_REQUIRE_COMPLEXITY.value, value=True)
    policy = await password_service.load_policy()

    with pytest.raises(ValidationError) as short:
        password_service.validate_new_password("Ab1!", username="u", policy=policy)
    assert short.value.details.get("min_length") == 10

    with pytest.raises(ValidationError) as weak:
        password_service.validate_new_password("alllowercase1", username="u", policy=policy)
    assert weak.value.details.get("reason") == "complexity"

    with pytest.raises(ValidationError) as named:
        password_service.validate_new_password("Xxcashier1!", username="cashier", policy=policy)
    assert named.value.details.get("reason") == "contains_username"

    password_service.validate_new_password("GoodPass1!", username="cashier", policy=policy)


@pytest.mark.asyncio
async def test_password_reuse_blocked(
    password_service: PasswordService,
    db_session: AsyncSession,
) -> None:
    user = await _create_user(db_session, username="reuse1", password="Password1!")
    policy = await password_service.load_policy()

    with pytest.raises(ValidationError) as exc:
        await password_service.assert_not_reused(user, "Password1!", policy=policy)
    assert exc.value.details.get("reason") == "reuse"

    sessions = SessionService(db_session, settings=SettingService(db_session))
    login_session, _ = await sessions.create_session(user, record_login=False)
    await password_service.change_password(
        user,
        "Password1!",
        "Password2!",
        current_session_id=login_session.id,
    )
    user = await UserService(db_session).get_user(user.id)
    with pytest.raises(ValidationError):
        await password_service.assert_not_reused(user, "Password1!", policy=policy)
    with pytest.raises(ValidationError):
        await password_service.assert_not_reused(user, "Password2!", policy=policy)


@pytest.mark.asyncio
async def test_change_password_clears_flag_and_keeps_session(
    password_service: PasswordService,
    db_session: AsyncSession,
) -> None:
    user = await _create_user(
        db_session,
        username="chg1",
        must_change_password=True,
    )
    sessions = SessionService(db_session, settings=SettingService(db_session))
    current, _ = await sessions.create_session(user, record_login=False)
    other, _ = await sessions.create_session(user, record_login=False)

    updated = await password_service.change_password(
        user,
        "Password1!",
        "NewPass12!",
        current_session_id=current.id,
    )
    assert updated.must_change_password is False

    active = await sessions.list_sessions(user.id)
    assert len(active) == 1
    assert active[0].id == current.id
    with pytest.raises(Exception):
        await sessions.get_active(other.id)


@pytest.mark.asyncio
async def test_admin_reset_forces_change_and_revokes(
    password_service: PasswordService,
    db_session: AsyncSession,
) -> None:
    user = await _create_user(db_session, username="resetme")
    sessions = SessionService(db_session, settings=SettingService(db_session))
    await sessions.create_session(user, record_login=False)
    await sessions.create_session(user, record_login=False)

    updated = await password_service.admin_reset_password(
        user.id,
        "ResetPass1!",
        actor_id=user.id,
    )
    assert updated.must_change_password is True
    assert await sessions.list_sessions(user.id) == []


@pytest.mark.asyncio
async def test_password_expiration_requires_change(
    password_service: PasswordService,
    db_session: AsyncSession,
) -> None:
    settings = SettingService(db_session)
    await settings.update_setting(SettingKey.PASSWORD_EXPIRE_DAYS.value, value=30)
    user = await _create_user(db_session, username="expire1")
    user.password_changed_at = utc_now() - timedelta(days=40)
    await db_session.flush()

    assert await password_service.requires_password_change(user) is True

    user.password_changed_at = utc_now() - timedelta(days=5)
    await db_session.flush()
    user.must_change_password = False
    assert await password_service.requires_password_change(user) is False


@pytest.mark.asyncio
async def test_change_password_wrong_current(
    password_service: PasswordService,
    db_session: AsyncSession,
) -> None:
    user = await _create_user(db_session, username="wrongcur")
    sessions = SessionService(db_session, settings=SettingService(db_session))
    login_session, _ = await sessions.create_session(user, record_login=False)
    with pytest.raises(AuthenticationError):
        await password_service.change_password(
            user,
            "NopePass1!",
            "NewPass12!",
            current_session_id=login_session.id,
        )
