"""Session management HTTP endpoints — Identity Phase 4."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.modules.identity.dependencies import get_current_user, get_session_service
from app.modules.identity.schemas.session import (
    AuthenticatedPrincipal,
    SessionListResponse,
    SessionResponse,
)
from app.modules.identity.schemas.user import MessageOnlyResponse
from app.modules.identity.services.session import SessionService

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.get(
    "",
    response_model=SessionListResponse,
    summary="List current user sessions",
)
async def list_sessions(
    principal: Annotated[AuthenticatedPrincipal, Depends(get_current_user)],
    service: Annotated[SessionService, Depends(get_session_service)],
) -> SessionListResponse:
    """List active sessions for the authenticated user."""
    items = await service.list_sessions(principal.user.id)
    return SessionListResponse(
        data=[
            SessionResponse.from_model(
                item,
                is_current=item.id == principal.session_id,
            )
            for item in items
        ]
    )


@router.delete(
    "",
    response_model=MessageOnlyResponse,
    summary="Logout all sessions",
)
async def logout_all_sessions(
    principal: Annotated[AuthenticatedPrincipal, Depends(get_current_user)],
    service: Annotated[SessionService, Depends(get_session_service)],
) -> MessageOnlyResponse:
    """Revoke all sessions for the authenticated user."""
    await service.logout_all(principal.user.id, actor_id=principal.user.id)
    return MessageOnlyResponse(message="تم تسجيل الخروج من جميع الجلسات")


@router.delete(
    "/{session_id}",
    response_model=MessageOnlyResponse,
    status_code=status.HTTP_200_OK,
    summary="Revoke a session",
)
async def revoke_session(
    session_id: UUID,
    principal: Annotated[AuthenticatedPrincipal, Depends(get_current_user)],
    service: Annotated[SessionService, Depends(get_session_service)],
) -> MessageOnlyResponse:
    """Revoke one session owned by the authenticated user (logout current when id matches)."""
    await service.revoke_session(
        session_id,
        actor_id=principal.user.id,
        user_id=principal.user.id,
    )
    return MessageOnlyResponse(message="تم إلغاء الجلسة")
