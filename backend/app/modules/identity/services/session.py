"""SessionService — login session lifecycle (Identity Phase 4/5)."""

from __future__ import annotations

from datetime import timedelta
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import AuthenticationError, NotFoundError
from app.modules.identity.models.login_session import LoginSession
from app.modules.identity.models.user import User
from app.modules.identity.repositories.login_session import LoginSessionRepository
from app.modules.identity.repositories.user import UserRepository
from app.modules.identity.schemas.token import TokenPair
from app.modules.identity.services.login_history import LoginHistoryService
from app.modules.identity.services.token import TokenService
from app.modules.settings.services.setting import SettingService
from app.utils.datetime import ensure_utc, utc_now


class SessionService:
    """Create, list, and revoke user login sessions."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        login_sessions: LoginSessionRepository | None = None,
        tokens: TokenService | None = None,
        settings: SettingService | None = None,
        login_history: LoginHistoryService | None = None,
        users: UserRepository | None = None,
    ) -> None:
        self.session = session
        self.login_sessions = login_sessions or LoginSessionRepository(session)
        self.settings = settings or SettingService(session)
        self.tokens = tokens or TokenService(session, settings=self.settings)
        self.login_history = login_history or LoginHistoryService(session)
        self.users = users or UserRepository(session)

    async def create_session(
        self,
        user: User,
        *,
        device_name: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        remember_me: bool = False,
        record_login: bool = True,
    ) -> tuple[LoginSession, TokenPair]:
        """Create a login session and issue access + refresh tokens for it."""
        policy = await self.tokens.load_token_policy()
        refresh_days = (
            max(1, policy.remember_me_refresh_token_expire_days)
            if remember_me
            else max(1, policy.refresh_token_expire_days)
        )
        now = utc_now()
        login_session = LoginSession(
            user_id=user.id,
            device_name=device_name,
            ip_address=ip_address,
            last_activity_at=now,
            expires_at=now + timedelta(days=refresh_days),
            remember_me=remember_me,
            created_by=user.id,
            updated_by=user.id,
        )
        await self.login_sessions.add(login_session)
        pair = await self.tokens.issue_tokens(user, session=login_session)
        if record_login:
            await self.login_history.record_login_success(
                username_attempted=user.username,
                user_id=user.id,
                session_id=login_session.id,
                ip_address=ip_address,
                device_name=device_name,
                user_agent=user_agent,
            )
        return login_session, pair

    async def list_sessions(self, user_id: UUID) -> list[LoginSession]:
        """List active sessions for a user."""
        return await self.login_sessions.list_active_for_user(user_id)

    async def get_active(self, session_id: UUID) -> LoginSession:
        """Return an active session or raise AuthenticationError."""
        login_session = await self.login_sessions.get_by_id(session_id)
        if (
            login_session is None
            or login_session.is_deleted
            or login_session.revoked_at is not None
            or ensure_utc(login_session.expires_at) <= utc_now()
        ):
            raise AuthenticationError("الجلسة غير صالحة أو منتهية الصلاحية")
        return login_session

    async def touch(self, session_id: UUID) -> LoginSession:
        """Update last activity timestamp for an active session."""
        login_session = await self.get_active(session_id)
        now = utc_now()
        login_session.last_activity_at = now
        login_session.updated_at = now
        await self.session.flush()
        return login_session

    async def revoke_session(
        self,
        session_id: UUID,
        *,
        actor_id: UUID,
        user_id: UUID,
        record_logout: bool = True,
    ) -> LoginSession:
        """Revoke a session owned by ``user_id`` and its refresh tokens."""
        login_session = await self.login_sessions.get_by_id(session_id)
        if login_session is None or login_session.is_deleted or login_session.user_id != user_id:
            raise NotFoundError("الجلسة غير موجودة")

        newly_revoked = login_session.revoked_at is None
        if newly_revoked:
            now = utc_now()
            login_session.revoked_at = now
            login_session.revoked_by = actor_id
            login_session.updated_at = now
            login_session.updated_by = actor_id
            await self.session.flush()

        await self.tokens.revoke_refresh_tokens_for_session(session_id)
        if newly_revoked and record_logout:
            user = await self.users.get_by_id(user_id, include_deleted=True)
            username = user.username if user is not None else str(user_id)
            await self.login_history.record_logout(
                username_attempted=username,
                user_id=user_id,
                session_id=session_id,
                ip_address=login_session.ip_address,
                device_name=login_session.device_name,
            )
        return login_session

    async def logout_all(
        self,
        user_id: UUID,
        *,
        actor_id: UUID,
        record_logout: bool = True,
    ) -> int:
        """Revoke all active sessions and refresh tokens for a user."""
        active = await self.login_sessions.list_active_for_user(user_id)
        now = utc_now()
        user = await self.users.get_by_id(user_id, include_deleted=True)
        username = user.username if user is not None else str(user_id)
        for login_session in active:
            login_session.revoked_at = now
            login_session.revoked_by = actor_id
            login_session.updated_at = now
            login_session.updated_by = actor_id
            if record_logout:
                await self.login_history.record_logout(
                    username_attempted=username,
                    user_id=user_id,
                    session_id=login_session.id,
                    ip_address=login_session.ip_address,
                    device_name=login_session.device_name,
                )
        if active:
            await self.session.flush()
        await self.tokens.revoke_all_for_user(user_id)
        return len(active)

    async def logout_all_except(
        self,
        user_id: UUID,
        *,
        keep_session_id: UUID,
        actor_id: UUID,
        record_logout: bool = True,
    ) -> int:
        """Revoke all active sessions except ``keep_session_id``."""
        active = await self.login_sessions.list_active_for_user(user_id)
        count = 0
        for login_session in active:
            if login_session.id == keep_session_id:
                continue
            await self.revoke_session(
                login_session.id,
                actor_id=actor_id,
                user_id=user_id,
                record_logout=record_logout,
            )
            count += 1
        return count
