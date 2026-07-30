"""TokenService tests — Identity Phase 3/4 JWT infrastructure (session-bound)."""

from datetime import timedelta

import pytest
from app.exceptions import AuthenticationError
from app.modules.identity.repositories.refresh_token import RefreshTokenRepository
from app.modules.identity.services.session import SessionService
from app.modules.identity.services.token import TokenService
from app.modules.identity.services.user import UserService
from app.modules.rbac.constants import SystemRoleName
from app.modules.rbac.services.role import RoleService
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.security.jwt import create_access_token, create_refresh_token
from app.security.tokens import hash_refresh_token
from app.utils.datetime import utc_now
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
async def token_service(db_session: AsyncSession) -> TokenService:
    from tests.helpers.identity import seed_identity_basics

    await seed_identity_basics(db_session)
    return TokenService(db_session, settings=SettingService(db_session))


@pytest.fixture
async def session_service(db_session: AsyncSession, token_service: TokenService) -> SessionService:
    return SessionService(
        db_session,
        tokens=token_service,
        settings=SettingService(db_session),
    )


async def _create_cashier(
    db_session: AsyncSession,
    *,
    username: str = "cashier1",
    password: str = "Password1!",
):
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
    return user


@pytest.mark.asyncio
async def test_issue_tokens_and_validate(
    session_service: SessionService,
    token_service: TokenService,
    db_session: AsyncSession,
) -> None:
    user = await _create_cashier(db_session, username="tokuser")
    login_session, pair = await session_service.create_session(
        user,
        device_name="POS-1",
        ip_address="127.0.0.1",
    )

    assert pair.token_type == "bearer"
    assert pair.access_token
    assert pair.refresh_token

    claims = token_service.validate_access_token(pair.access_token)
    assert claims["sub"] == str(user.id)
    assert claims["type"] == "access"
    assert claims["sid"] == str(login_session.id)

    repo = RefreshTokenRepository(db_session)
    stored = await repo.get_by_token_hash(hash_refresh_token(pair.refresh_token))
    assert stored is not None
    assert stored.user_id == user.id
    assert stored.session_id == login_session.id
    assert stored.token_hash != pair.refresh_token


@pytest.mark.asyncio
async def test_access_validation_failures(token_service: TokenService) -> None:
    with pytest.raises(AuthenticationError):
        token_service.validate_access_token("not.a.jwt")

    refresh_shaped = create_refresh_token("11111111-1111-1111-1111-111111111111")
    with pytest.raises(AuthenticationError):
        token_service.validate_access_token(refresh_shaped)


@pytest.mark.asyncio
async def test_access_token_expiration(
    token_service: TokenService,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.security import jwt as jwt_mod

    fixed_now = utc_now() - timedelta(hours=2)
    monkeypatch.setattr(jwt_mod, "utc_now", lambda: fixed_now)

    expired = create_access_token(
        "11111111-1111-1111-1111-111111111111",
        expires_minutes=1,
    )
    monkeypatch.setattr(jwt_mod, "utc_now", utc_now)

    with pytest.raises(AuthenticationError):
        token_service.validate_access_token(expired)


@pytest.mark.asyncio
async def test_rotate_refresh_token(
    session_service: SessionService,
    token_service: TokenService,
    db_session: AsyncSession,
) -> None:
    user = await _create_cashier(db_session, username="rotuser")
    login_session, original = await session_service.create_session(user, device_name="Desk")
    rotated = await token_service.rotate_refresh_token(original.refresh_token)

    assert rotated.refresh_token != original.refresh_token
    claims = token_service.validate_access_token(rotated.access_token)
    assert claims["sub"] == str(user.id)
    assert claims["sid"] == str(login_session.id)

    repo = RefreshTokenRepository(db_session)
    old_row = await repo.get_by_token_hash(hash_refresh_token(original.refresh_token))
    new_row = await repo.get_by_token_hash(hash_refresh_token(rotated.refresh_token))
    assert old_row is not None
    assert new_row is not None
    assert old_row.revoked_at is not None
    assert old_row.replaced_by_id == new_row.id
    assert new_row.session_id == login_session.id

    with pytest.raises(AuthenticationError):
        await token_service.rotate_refresh_token(original.refresh_token)


@pytest.mark.asyncio
async def test_refresh_reuse_revokes_session_family(
    session_service: SessionService,
    token_service: TokenService,
    db_session: AsyncSession,
) -> None:
    user = await _create_cashier(db_session, username="reuse1")
    first_session, first = await session_service.create_session(user)
    second_session, second = await session_service.create_session(user)
    rotated = await token_service.rotate_refresh_token(first.refresh_token)

    with pytest.raises(AuthenticationError) as exc_info:
        await token_service.rotate_refresh_token(first.refresh_token)
    assert exc_info.value.details.get("reason") == "refresh_reuse"

    # First session family revoked; second session remains.
    assert await RefreshTokenRepository(db_session).list_active_for_session(first_session.id) == []
    active_second = await RefreshTokenRepository(db_session).list_active_for_session(
        second_session.id
    )
    assert len(active_second) == 1

    with pytest.raises(AuthenticationError):
        await token_service.rotate_refresh_token(rotated.refresh_token)

    # Other session still rotatable.
    again = await token_service.rotate_refresh_token(second.refresh_token)
    assert again.refresh_token


@pytest.mark.asyncio
async def test_explicit_revoke(
    session_service: SessionService,
    token_service: TokenService,
    db_session: AsyncSession,
) -> None:
    user = await _create_cashier(db_session, username="revuser")
    _, pair = await session_service.create_session(user)
    await token_service.revoke_refresh_token(pair.refresh_token)

    with pytest.raises(AuthenticationError):
        await token_service.rotate_refresh_token(pair.refresh_token)

    await token_service.revoke_refresh_token(pair.refresh_token)


@pytest.mark.asyncio
async def test_expired_refresh_rejected(
    session_service: SessionService,
    token_service: TokenService,
    db_session: AsyncSession,
) -> None:
    user = await _create_cashier(db_session, username="expuser")
    _, pair = await session_service.create_session(user)

    repo = RefreshTokenRepository(db_session)
    row = await repo.get_by_token_hash(hash_refresh_token(pair.refresh_token))
    assert row is not None
    row.expires_at = utc_now() - timedelta(seconds=1)
    await db_session.flush()

    with pytest.raises(AuthenticationError):
        await token_service.rotate_refresh_token(pair.refresh_token)


@pytest.mark.asyncio
async def test_load_token_policy(
    token_service: TokenService,
    db_session: AsyncSession,
) -> None:
    settings = SettingService(db_session)
    await settings.update_setting(SettingKey.ACCESS_TOKEN_EXPIRE_MINUTES.value, value=30)
    await settings.update_setting(SettingKey.REFRESH_TOKEN_EXPIRE_DAYS.value, value=3)
    await settings.update_setting(
        SettingKey.REMEMBER_ME_REFRESH_TOKEN_EXPIRE_DAYS.value,
        value=45,
    )

    policy = await token_service.load_token_policy()
    assert policy.access_token_expire_minutes == 30
    assert policy.refresh_token_expire_days == 3
    assert policy.remember_me_refresh_token_expire_days == 45


@pytest.mark.asyncio
async def test_unknown_refresh_fails(token_service: TokenService) -> None:
    with pytest.raises(AuthenticationError):
        await token_service.rotate_refresh_token("totally-unknown-refresh")
    with pytest.raises(AuthenticationError):
        await token_service.revoke_refresh_token("totally-unknown-refresh")


@pytest.mark.asyncio
async def test_revoke_all_for_user(
    session_service: SessionService,
    token_service: TokenService,
    db_session: AsyncSession,
) -> None:
    user = await _create_cashier(db_session, username="allrev")
    await session_service.create_session(user)
    await session_service.create_session(user)
    count = await token_service.revoke_all_for_user(user.id)
    assert count == 2
    assert await RefreshTokenRepository(db_session).list_active_for_user(user.id) == []
