"""LoginHistoryService tests — Identity Phase 5."""

import pytest
from app.modules.identity.constants import (
    AuthenticationFailureReason,
    LoginHistoryEventType,
)
from app.modules.identity.services.authentication import AuthenticationService
from app.modules.identity.services.login_history import LoginHistoryService
from app.modules.identity.services.session import SessionService
from app.modules.identity.services.user import UserService
from app.modules.rbac.constants import SystemRoleName
from app.modules.rbac.services.role import RoleService
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
async def history_service(db_session: AsyncSession) -> LoginHistoryService:
    from tests.helpers.identity import seed_identity_basics

    await seed_identity_basics(db_session)
    return LoginHistoryService(db_session)


async def _create_user(
    db_session: AsyncSession,
    *,
    username: str = "cashier1",
    role_name: str = SystemRoleName.CASHIER.value,
):
    roles = RoleService(db_session)
    role = await roles.get_by_name(role_name)
    users = UserService(db_session)
    return await users.create_user(
        username=username,
        password="Password1!",
        full_name="Staff",
        role_id=role.id,
        must_change_password=False,
    )


@pytest.mark.asyncio
async def test_record_login_failure(
    history_service: LoginHistoryService,
    db_session: AsyncSession,
) -> None:
    auth = AuthenticationService(db_session, settings=SettingService(db_session))
    await auth.authenticate("missing", "x", ip_address="1.1.1.1", device_name="POS")

    items, total = await history_service.list_history(
        event_type=LoginHistoryEventType.LOGIN.value,
        success=False,
    )
    assert total >= 1
    assert items[0].failure_reason == AuthenticationFailureReason.USER_NOT_FOUND.value
    assert items[0].ip_address == "1.1.1.1"
    assert items[0].device_name == "POS"


@pytest.mark.asyncio
async def test_record_login_success_via_session(
    history_service: LoginHistoryService,
    db_session: AsyncSession,
) -> None:
    user = await _create_user(db_session, username="oklogin")
    sessions = SessionService(db_session, settings=SettingService(db_session))
    login_session, _ = await sessions.create_session(
        user,
        device_name="Desk",
        ip_address="10.0.0.1",
        record_login=True,
    )

    items, total = await history_service.list_history(
        user_id=user.id,
        event_type=LoginHistoryEventType.LOGIN.value,
        success=True,
    )
    assert total == 1
    assert items[0].session_id == login_session.id
    assert items[0].device_name == "Desk"


@pytest.mark.asyncio
async def test_record_logout(
    history_service: LoginHistoryService,
    db_session: AsyncSession,
) -> None:
    user = await _create_user(db_session, username="logout1")
    sessions = SessionService(db_session, settings=SettingService(db_session))
    login_session, _ = await sessions.create_session(user, record_login=False)
    await sessions.revoke_session(
        login_session.id,
        actor_id=user.id,
        user_id=user.id,
    )

    items, total = await history_service.list_history(
        user_id=user.id,
        event_type=LoginHistoryEventType.LOGOUT.value,
    )
    assert total == 1
    assert items[0].session_id == login_session.id
    assert items[0].success is True


@pytest.mark.asyncio
async def test_record_account_locked(
    history_service: LoginHistoryService,
    db_session: AsyncSession,
) -> None:
    settings = SettingService(db_session)
    await settings.update_setting(SettingKey.MAX_FAILED_LOGIN_ATTEMPTS.value, value=2)
    await settings.update_setting(SettingKey.ACCOUNT_LOCK_DURATION_MINUTES.value, value=0)

    user = await _create_user(db_session, username="lockhist")
    auth = AuthenticationService(db_session, settings=settings)
    await auth.authenticate("lockhist", "WrongPass1!")
    await auth.authenticate("lockhist", "WrongPass1!")

    locked_rows, locked_total = await history_service.list_history(
        user_id=user.id,
        event_type=LoginHistoryEventType.ACCOUNT_LOCKED.value,
    )
    assert locked_total == 1
    assert locked_rows[0].success is False
    assert locked_rows[0].failure_reason == AuthenticationFailureReason.LOCKED.value


@pytest.mark.asyncio
async def test_record_password_reset(
    history_service: LoginHistoryService,
    db_session: AsyncSession,
) -> None:
    user = await _create_user(db_session, username="reset1")
    users = UserService(db_session)
    await users.admin_reset_password(user.id, "NewPass12!", actor_id=user.id)

    items, total = await history_service.list_history(
        user_id=user.id,
        event_type=LoginHistoryEventType.PASSWORD_RESET.value,
    )
    assert total == 1
    assert items[0].success is True


@pytest.mark.asyncio
async def test_filtering_search_pagination(
    history_service: LoginHistoryService,
    db_session: AsyncSession,
) -> None:
    user_a = await _create_user(db_session, username="filter_a")
    user_b = await _create_user(db_session, username="filter_b")
    sessions = SessionService(db_session, settings=SettingService(db_session))
    await sessions.create_session(user_a, record_login=True)
    await sessions.create_session(user_b, record_login=True)
    auth = AuthenticationService(db_session, settings=SettingService(db_session))
    await auth.authenticate("filter_a", "bad")

    items, total = await history_service.list_history(q="filter_a", limit=10)
    assert total >= 2
    assert all("filter_a" in row.username_attempted for row in items)

    page1, total_all = await history_service.list_history(offset=0, limit=1)
    assert len(page1) == 1
    assert total_all >= 3

    by_user, user_total = await history_service.list_history(user_id=user_b.id)
    assert user_total == 1
    assert by_user[0].user_id == user_b.id
