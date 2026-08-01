"""FastAPI dependencies for Identity (including Bearer principal resolution)."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db
from app.exceptions import AuthenticationError, BusinessError
from app.modules.identity.repositories.user import UserRepository
from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.identity.services.auth import AuthService
from app.modules.identity.services.authentication import AuthenticationService
from app.modules.identity.services.login_history import LoginHistoryService
from app.modules.identity.services.password import PasswordService
from app.modules.identity.services.session import SessionService
from app.modules.identity.services.token import TokenService
from app.modules.identity.services.user import UserService
from app.modules.settings.dependencies import get_setting_service
from app.modules.settings.services.setting import SettingService

_bearer_scheme = HTTPBearer(auto_error=False)

# Path prefixes allowed while must_change_password / expiry force-change is active.
_PASSWORD_CHANGE_ALLOWLIST_PREFIXES = (
    "/api/v1/change-password",
    "/api/v1/sessions",
)

# Exact method+path pairs allowed during force-change (in addition to prefixes).
_PASSWORD_CHANGE_ALLOWLIST_ROUTES = frozenset(
    {
        ("POST", "/api/v1/logout"),
        ("POST", "/api/v1/logout-all"),
        ("GET", "/api/v1/me"),
    }
)


def _allowed_during_force_change(path: str, method: str) -> bool:
    normalized = path.rstrip("/") or "/"
    method_upper = method.upper()
    if (method_upper, normalized) in _PASSWORD_CHANGE_ALLOWLIST_ROUTES:
        return True
    for prefix in _PASSWORD_CHANGE_ALLOWLIST_PREFIXES:
        if normalized == prefix or normalized.startswith(prefix + "/"):
            return True
    return False


async def get_user_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> UserService:
    """Provide a request-scoped UserService."""
    return UserService(session)


async def get_authentication_service(
    session: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[SettingService, Depends(get_setting_service)],
) -> AuthenticationService:
    """Provide a request-scoped AuthenticationService (engine only; no HTTP login yet)."""
    return AuthenticationService(session, settings=settings)


async def get_token_service(
    session: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[SettingService, Depends(get_setting_service)],
) -> TokenService:
    """Provide a request-scoped TokenService (no HTTP login routes yet)."""
    return TokenService(session, settings=settings)


async def get_session_service(
    session: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[SettingService, Depends(get_setting_service)],
) -> SessionService:
    """Provide a request-scoped SessionService."""
    return SessionService(session, settings=settings)


async def get_login_history_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> LoginHistoryService:
    """Provide a request-scoped LoginHistoryService."""
    return LoginHistoryService(session)


async def get_password_service(
    session: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[SettingService, Depends(get_setting_service)],
) -> PasswordService:
    """Provide a request-scoped PasswordService."""
    return PasswordService(session, settings=settings)


async def get_auth_service(
    session: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[SettingService, Depends(get_setting_service)],
) -> AuthService:
    """Provide a request-scoped AuthService (login/refresh orchestration)."""
    return AuthService(session, settings=settings)


async def get_optional_bearer_token(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(_bearer_scheme),
    ],
) -> str | None:
    """Extract an optional Bearer access token from the Authorization header."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    return credentials.credentials


async def get_current_user(
    request: Request,
    token: Annotated[str | None, Depends(get_optional_bearer_token)],
    db: Annotated[AsyncSession, Depends(get_db)],
    tokens: Annotated[TokenService, Depends(get_token_service)],
    sessions: Annotated[SessionService, Depends(get_session_service)],
    passwords: Annotated[PasswordService, Depends(get_password_service)],
) -> AuthenticatedPrincipal:
    """
    Resolve the authenticated principal from a Bearer access token.

    Requires a valid access JWT with ``sid`` bound to an active LoginSession.
    When password change is required, only allowlisted routes may proceed.
    """
    if not token:
        raise AuthenticationError("المصادقة مطلوبة")

    claims = tokens.validate_access_token(token)
    sid_raw = claims.get("sid")
    if not sid_raw:
        raise AuthenticationError("رمز المصادقة لا يحتوي على معرف الجلسة")

    try:
        session_id = UUID(str(sid_raw))
        user_id = UUID(str(claims["sub"]))
    except (TypeError, ValueError) as exc:
        raise AuthenticationError("رمز المصادقة غير صالح") from exc

    user = await UserRepository(db).get_by_id(user_id)
    if user is None or user.is_deleted:
        raise AuthenticationError("المستخدم غير موجود")
    if not user.is_active:
        raise AuthenticationError("الحساب غير نشط")
    if user.is_locked:
        raise AuthenticationError("الحساب مقفل")

    login_session = await sessions.get_active(session_id)
    if login_session.user_id != user.id:
        raise AuthenticationError("الجلسة غير مطابقة للمستخدم")

    if await passwords.requires_password_change(user):
        if not _allowed_during_force_change(request.url.path, request.method):
            raise BusinessError(
                "يجب تغيير كلمة المرور قبل المتابعة",
                code="password_change_required",
                status_code=403,
            )

    return AuthenticatedPrincipal(user=user, session_id=login_session.id)
