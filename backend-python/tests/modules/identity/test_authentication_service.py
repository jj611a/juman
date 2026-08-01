"""AuthenticationService unit tests — Identity Phase 2 engine."""

from datetime import timedelta

import pytest
from app.modules.identity.constants import AuthenticationFailureReason
from app.modules.identity.services.authentication import AuthenticationService
from app.modules.identity.services.user import UserService
from app.modules.rbac.constants import SystemRoleName
from app.modules.rbac.services.role import RoleService
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.utils.datetime import utc_now
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
async def auth_service(db_session: AsyncSession) -> AuthenticationService:
    from tests.helpers.identity import seed_identity_basics

    await seed_identity_basics(db_session)
    return AuthenticationService(db_session, settings=SettingService(db_session))


async def _create_cashier(
    db_session: AsyncSession,
    *,
    username: str = "cashier1",
    password: str = "Password1!",
) -> tuple[UserService, object]:
    roles = RoleService(db_session)
    cashier = await roles.get_by_name(SystemRoleName.CASHIER.value)
    users = UserService(db_session)
    user = await users.create_user(
        username=username,
        password=password,
        full_name="Cashier",
        role_id=cashier.id,
        must_change_password=False,
    )
    return users, user


@pytest.mark.asyncio
async def test_wrong_username(auth_service: AuthenticationService) -> None:
    result = await auth_service.authenticate("missing", "Password1!")
    assert result.success is False
    assert result.failure_reason == AuthenticationFailureReason.USER_NOT_FOUND
    assert result.user is None


@pytest.mark.asyncio
async def test_wrong_password(
    auth_service: AuthenticationService,
    db_session: AsyncSession,
) -> None:
    _, user = await _create_cashier(db_session)
    result = await auth_service.authenticate(user.username, "WrongPass1!")
    assert result.success is False
    assert result.failure_reason == AuthenticationFailureReason.BAD_PASSWORD
    assert result.user is not None
    assert result.user.failed_login_attempts == 1


@pytest.mark.asyncio
async def test_inactive_account(
    auth_service: AuthenticationService,
    db_session: AsyncSession,
) -> None:
    users, user = await _create_cashier(db_session, username="inactive1")
    await users.deactivate_user(user.id)
    result = await auth_service.authenticate("inactive1", "Password1!")
    assert result.success is False
    assert result.failure_reason == AuthenticationFailureReason.INACTIVE


@pytest.mark.asyncio
async def test_deleted_account(
    auth_service: AuthenticationService,
    db_session: AsyncSession,
) -> None:
    users, user = await _create_cashier(db_session, username="deleted1")
    await users.soft_delete_user(user.id)
    result = await auth_service.authenticate("deleted1", "Password1!")
    assert result.success is False
    assert result.failure_reason == AuthenticationFailureReason.DELETED


@pytest.mark.asyncio
async def test_locked_account(
    auth_service: AuthenticationService,
    db_session: AsyncSession,
) -> None:
    _, user = await _create_cashier(db_session, username="locked1")
    user.is_locked = True
    user.locked_until = None
    await db_session.flush()

    result = await auth_service.authenticate("locked1", "Password1!")
    assert result.success is False
    assert result.failure_reason == AuthenticationFailureReason.LOCKED


@pytest.mark.asyncio
async def test_success_and_counter_reset(
    auth_service: AuthenticationService,
    db_session: AsyncSession,
) -> None:
    _, user = await _create_cashier(db_session, username="okuser")
    user.failed_login_attempts = 3
    await db_session.flush()

    bad = await auth_service.authenticate("okuser", "WrongPass1!")
    assert bad.failure_reason == AuthenticationFailureReason.BAD_PASSWORD
    assert bad.user is not None
    assert bad.user.failed_login_attempts == 4

    ok = await auth_service.authenticate("okuser", "Password1!")
    assert ok.success is True
    assert ok.failure_reason is None
    assert ok.user is not None
    assert ok.user.failed_login_attempts == 0
    assert ok.user.is_locked is False
    assert ok.user.last_login_at is not None


@pytest.mark.asyncio
async def test_lock_threshold(
    auth_service: AuthenticationService,
    db_session: AsyncSession,
) -> None:
    settings = SettingService(db_session)
    await settings.update_setting(SettingKey.MAX_FAILED_LOGIN_ATTEMPTS.value, value=3)
    await settings.update_setting(SettingKey.ACCOUNT_LOCK_DURATION_MINUTES.value, value=0)

    _, user = await _create_cashier(db_session, username="threshold1")
    for _ in range(2):
        result = await auth_service.authenticate("threshold1", "WrongPass1!")
        assert result.failure_reason == AuthenticationFailureReason.BAD_PASSWORD

    locked = await auth_service.authenticate("threshold1", "WrongPass1!")
    assert locked.failure_reason == AuthenticationFailureReason.LOCKED
    assert locked.user is not None
    assert locked.user.is_locked is True
    assert locked.user.failed_login_attempts >= 3

    # Correct password still blocked while locked.
    still = await auth_service.authenticate("threshold1", "Password1!")
    assert still.failure_reason == AuthenticationFailureReason.LOCKED


@pytest.mark.asyncio
async def test_timed_lock_expires(
    auth_service: AuthenticationService,
    db_session: AsyncSession,
) -> None:
    _, user = await _create_cashier(db_session, username="timed1")
    user.is_locked = True
    user.locked_until = utc_now() - timedelta(minutes=1)
    user.failed_login_attempts = 5
    await db_session.flush()

    ok = await auth_service.authenticate("timed1", "Password1!")
    assert ok.success is True
    assert ok.user is not None
    assert ok.user.is_locked is False
    assert ok.user.failed_login_attempts == 0


@pytest.mark.asyncio
async def test_verify_password_and_policy_load(
    auth_service: AuthenticationService,
    db_session: AsyncSession,
) -> None:
    _, user = await _create_cashier(db_session, username="hashuser")
    assert auth_service.verify_password(user.password_hash, "Password1!") is True
    assert auth_service.verify_password(user.password_hash, "nope") is False

    policy = await auth_service.load_security_policy()
    assert policy.max_failed_login_attempts >= 1
    assert policy.password_min_length >= 1
    assert isinstance(policy.password_require_complexity, bool)
