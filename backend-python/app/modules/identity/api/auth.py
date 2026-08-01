"""Authentication HTTP endpoints — Identity Phase 7."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.modules.identity.dependencies import (
    get_auth_service,
    get_current_user,
    get_session_service,
)
from app.modules.identity.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    RefreshResponse,
    TokenData,
)
from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.identity.schemas.user import MessageOnlyResponse, UserResponse
from app.modules.identity.services.auth import AuthService
from app.modules.identity.services.session import SessionService

router = APIRouter(tags=["Auth"])


def _client_ip(request: Request) -> str | None:
    if request.client is None:
        return None
    return request.client.host


def _user_agent(request: Request) -> str | None:
    return request.headers.get("user-agent")


def _token_data(user, session, tokens) -> TokenData:
    return TokenData(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type=tokens.token_type,
        access_expires_at=tokens.access_expires_at,
        refresh_expires_at=tokens.refresh_expires_at,
        session_id=session.id,
        user=UserResponse.from_model(user),
    )


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Login",
)
async def login(
    body: LoginRequest,
    request: Request,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> LoginResponse:
    """Authenticate and issue access + refresh tokens bound to a session."""
    outcome = await service.login(
        body.username,
        body.password,
        remember_me=body.remember_me,
        device_name=body.device_name,
        ip_address=_client_ip(request),
        user_agent=_user_agent(request),
    )
    return LoginResponse(
        data=_token_data(outcome.user, outcome.session, outcome.tokens),
    )


@router.post(
    "/refresh",
    response_model=RefreshResponse,
    summary="Refresh tokens",
)
async def refresh(
    body: RefreshRequest,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> RefreshResponse:
    """Rotate a refresh token into a new token pair."""
    user, session, tokens = await service.refresh(body.refresh_token)
    return RefreshResponse(data=_token_data(user, session, tokens))


@router.post(
    "/logout",
    response_model=MessageOnlyResponse,
    summary="Logout current session",
)
async def logout(
    principal: Annotated[AuthenticatedPrincipal, Depends(get_current_user)],
    sessions: Annotated[SessionService, Depends(get_session_service)],
) -> MessageOnlyResponse:
    """Revoke the current session."""
    await sessions.revoke_session(
        principal.session_id,
        actor_id=principal.user.id,
        user_id=principal.user.id,
    )
    return MessageOnlyResponse(message="تم تسجيل الخروج")


@router.post(
    "/logout-all",
    response_model=MessageOnlyResponse,
    summary="Logout all sessions",
)
async def logout_all(
    principal: Annotated[AuthenticatedPrincipal, Depends(get_current_user)],
    sessions: Annotated[SessionService, Depends(get_session_service)],
) -> MessageOnlyResponse:
    """Revoke all sessions for the current user."""
    await sessions.logout_all(principal.user.id, actor_id=principal.user.id)
    return MessageOnlyResponse(message="تم تسجيل الخروج من جميع الجلسات")
