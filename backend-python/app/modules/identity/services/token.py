"""TokenService — JWT access + opaque refresh bound to LoginSession."""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import timedelta
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import AppException, AuthenticationError
from app.modules.identity.constants import (
    DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES,
    DEFAULT_REFRESH_TOKEN_EXPIRE_DAYS,
    DEFAULT_REMEMBER_ME_REFRESH_TOKEN_EXPIRE_DAYS,
)
from app.modules.identity.models.login_session import LoginSession
from app.modules.identity.models.refresh_token import RefreshToken
from app.modules.identity.models.user import User
from app.modules.identity.repositories.login_session import LoginSessionRepository
from app.modules.identity.repositories.refresh_token import RefreshTokenRepository
from app.modules.identity.repositories.user import UserRepository
from app.modules.identity.schemas.token import TokenPair
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.security.jwt import create_access_token, decode_token
from app.security.tokens import hash_refresh_token
from app.utils.datetime import ensure_utc, utc_now


@dataclass(frozen=True, slots=True)
class TokenPolicy:
    """Access and refresh lifetimes loaded from Settings."""

    access_token_expire_minutes: int
    refresh_token_expire_days: int
    remember_me_refresh_token_expire_days: int


class TokenService:
    """
    Issue, validate, rotate, and revoke tokens bound to a LoginSession.

    Phase 4: refresh tokens require a session; reuse revokes the session family.
    """

    def __init__(
        self,
        session: AsyncSession,
        *,
        refresh_tokens: RefreshTokenRepository | None = None,
        login_sessions: LoginSessionRepository | None = None,
        users: UserRepository | None = None,
        settings: SettingService | None = None,
    ) -> None:
        self.session = session
        self.refresh_tokens = refresh_tokens or RefreshTokenRepository(session)
        self.login_sessions = login_sessions or LoginSessionRepository(session)
        self.users = users or UserRepository(session)
        self.settings = settings or SettingService(session)

    async def load_token_policy(self) -> TokenPolicy:
        """Read token TTL settings (with safe defaults)."""
        return TokenPolicy(
            access_token_expire_minutes=await self._setting_int(
                SettingKey.ACCESS_TOKEN_EXPIRE_MINUTES.value,
                DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES,
            ),
            refresh_token_expire_days=await self._setting_int(
                SettingKey.REFRESH_TOKEN_EXPIRE_DAYS.value,
                DEFAULT_REFRESH_TOKEN_EXPIRE_DAYS,
            ),
            remember_me_refresh_token_expire_days=await self._setting_int(
                SettingKey.REMEMBER_ME_REFRESH_TOKEN_EXPIRE_DAYS.value,
                DEFAULT_REMEMBER_ME_REFRESH_TOKEN_EXPIRE_DAYS,
            ),
        )

    async def issue_tokens(
        self,
        user: User,
        *,
        session: LoginSession,
    ) -> TokenPair:
        """Create an access JWT (with ``sid``) and persist a hashed opaque refresh token."""
        policy = await self.load_token_policy()
        access_minutes = max(1, policy.access_token_expire_minutes)

        now = utc_now()
        access_expires_at = now + timedelta(minutes=access_minutes)
        refresh_expires_at = ensure_utc(session.expires_at)

        raw_refresh = secrets.token_urlsafe(48)
        row = RefreshToken(
            user_id=user.id,
            session_id=session.id,
            token_hash=hash_refresh_token(raw_refresh),
            expires_at=refresh_expires_at,
            created_by=user.id,
            updated_by=user.id,
        )
        await self.refresh_tokens.add(row)

        access_token = create_access_token(
            user.id,
            expires_minutes=access_minutes,
            extra_claims={"sid": str(session.id)},
        )
        return TokenPair(
            access_token=access_token,
            refresh_token=raw_refresh,
            access_expires_at=access_expires_at,
            refresh_expires_at=refresh_expires_at,
        )

    def validate_access_token(self, token: str) -> dict[str, Any]:
        """Decode and validate an access JWT; raise AuthenticationError on failure."""
        return decode_token(token, expected_type="access")

    async def rotate_refresh_token(self, refresh_token: str) -> TokenPair:
        """
        Rotate a valid refresh token into a new TokenPair for the same session.

        Reuse of an already-rotated or revoked refresh token revokes that session family.
        """
        row = await self._lookup_refresh(refresh_token)
        if row is None:
            raise AuthenticationError("رمز التحديث غير صالح")

        if row.revoked_at is not None or row.replaced_by_id is not None:
            await self._revoke_session_family(row.session_id, actor_id=row.user_id)
            raise AuthenticationError(
                "تم اكتشاف إعادة استخدام رمز التحديث؛ تم إلغاء الجلسة",
                details={"reason": "refresh_reuse"},
            )

        if ensure_utc(row.expires_at) <= utc_now():
            row.revoked_at = utc_now()
            row.updated_at = utc_now()
            await self.session.flush()
            raise AuthenticationError("رمز التحديث منتهي الصلاحية")

        login_session = await self.login_sessions.get_by_id(row.session_id)
        if (
            login_session is None
            or login_session.is_deleted
            or login_session.revoked_at is not None
            or ensure_utc(login_session.expires_at) <= utc_now()
        ):
            await self._revoke_session_family(row.session_id, actor_id=row.user_id)
            raise AuthenticationError("الجلسة غير صالحة لتجديد الرموز")

        user = await self.users.get_by_id(row.user_id)
        if user is None or user.is_deleted or not user.is_active:
            await self.revoke_all_for_user(row.user_id)
            raise AuthenticationError("المستخدم غير صالح لتجديد الرموز")

        pair = await self.issue_tokens(user, session=login_session)

        new_row = await self.refresh_tokens.get_by_token_hash(
            hash_refresh_token(pair.refresh_token)
        )
        if new_row is None:
            raise AuthenticationError("تعذر إنشاء رمز التحديث الجديد")

        now = utc_now()
        row.revoked_at = now
        row.replaced_by_id = new_row.id
        row.updated_at = now
        row.updated_by = user.id
        login_session.last_activity_at = now
        login_session.updated_at = now
        await self.session.flush()
        return pair

    async def revoke_refresh_token(self, refresh_token: str) -> None:
        """Revoke a single refresh token by plaintext value."""
        row = await self._lookup_refresh(refresh_token)
        if row is None:
            raise AuthenticationError("رمز التحديث غير صالح")
        if row.revoked_at is not None:
            return
        row.revoked_at = utc_now()
        row.updated_at = utc_now()
        await self.session.flush()

    async def revoke_refresh_tokens_for_session(self, session_id: UUID) -> int:
        """Revoke all active refresh tokens for a login session."""
        active = await self.refresh_tokens.list_active_for_session(session_id)
        now = utc_now()
        for row in active:
            row.revoked_at = now
            row.updated_at = now
        if active:
            await self.session.flush()
        return len(active)

    async def revoke_all_for_user(self, user_id: UUID) -> int:
        """Revoke all active refresh tokens for a user. Returns count revoked."""
        active = await self.refresh_tokens.list_active_for_user(user_id)
        now = utc_now()
        for row in active:
            row.revoked_at = now
            row.updated_at = now
        if active:
            await self.session.flush()
        return len(active)

    async def _revoke_session_family(
        self,
        session_id: UUID,
        *,
        actor_id: UUID | None,
    ) -> None:
        login_session = await self.login_sessions.get_by_id(session_id)
        now = utc_now()
        if login_session is not None and login_session.revoked_at is None:
            login_session.revoked_at = now
            login_session.revoked_by = actor_id
            login_session.updated_at = now
        await self.revoke_refresh_tokens_for_session(session_id)

    async def _lookup_refresh(self, refresh_token: str) -> RefreshToken | None:
        return await self.refresh_tokens.get_by_token_hash(hash_refresh_token(refresh_token))

    async def _setting_int(self, key: str, default: int) -> int:
        try:
            return await self.settings.get_int(key)
        except AppException:
            return default
