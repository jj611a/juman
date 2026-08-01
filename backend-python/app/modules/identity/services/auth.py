"""AuthService — login orchestration (Identity Phase 7)."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import AuthenticationError
from app.modules.identity.models.login_session import LoginSession
from app.modules.identity.models.user import User
from app.modules.identity.schemas.token import TokenPair
from app.modules.identity.services.authentication import AuthenticationService
from app.modules.identity.services.session import SessionService
from app.modules.identity.services.token import TokenService
from app.modules.settings.services.setting import SettingService


@dataclass(frozen=True, slots=True)
class LoginOutcome:
    """Successful login result."""

    user: User
    session: LoginSession
    tokens: TokenPair


class AuthService:
    """Compose authentication engine + session issuance for HTTP login."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        authentication: AuthenticationService | None = None,
        sessions: SessionService | None = None,
        tokens: TokenService | None = None,
        settings: SettingService | None = None,
    ) -> None:
        self.session = session
        self.settings = settings or SettingService(session)
        self.authentication = authentication or AuthenticationService(
            session,
            settings=self.settings,
        )
        self.sessions = sessions or SessionService(session, settings=self.settings)
        self.tokens = tokens or TokenService(session, settings=self.settings)

    async def login(
        self,
        username: str,
        password: str,
        *,
        remember_me: bool = False,
        device_name: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> LoginOutcome:
        """Authenticate and create a session with tokens."""
        result = await self.authentication.authenticate(
            username,
            password,
            ip_address=ip_address,
            device_name=device_name,
            user_agent=user_agent,
        )
        if not result.success or result.user is None:
            raise AuthenticationError("اسم المستخدم أو كلمة المرور غير صحيحة")

        login_session, pair = await self.sessions.create_session(
            result.user,
            device_name=device_name,
            ip_address=ip_address,
            user_agent=user_agent,
            remember_me=remember_me,
            record_login=True,
        )
        return LoginOutcome(user=result.user, session=login_session, tokens=pair)

    async def refresh(self, refresh_token: str) -> tuple[User, LoginSession, TokenPair]:
        """Rotate refresh token and return updated pair with user/session."""
        pair = await self.tokens.rotate_refresh_token(refresh_token)
        # Recover session id from new access token claims.
        claims = self.tokens.validate_access_token(pair.access_token)
        session_id = UUID(str(claims["sid"]))
        login_session = await self.sessions.get_active(session_id)
        user = await self.sessions.users.get_by_id(login_session.user_id)
        if user is None:
            raise AuthenticationError("المستخدم غير موجود")
        return user, login_session, pair
