"""Login history HTTP endpoints — Identity Phase 5 (admin only)."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.modules.identity.constants import IdentityPermission
from app.modules.identity.dependencies import get_login_history_service
from app.modules.identity.schemas.login_history import (
    LoginHistoryListResponse,
    LoginHistoryResponse,
)
from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.identity.services.login_history import LoginHistoryService
from app.modules.rbac.dependencies import require_permission
from app.schemas.common import PaginationMeta

router = APIRouter(tags=["Login History"])


@router.get(
    "/login-history",
    response_model=LoginHistoryListResponse,
    summary="List login history (admin)",
)
async def list_login_history(
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(IdentityPermission.USERS_VIEW_LOGIN_HISTORY.value)),
    ],
    service: Annotated[LoginHistoryService, Depends(get_login_history_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    event_type: Annotated[str | None, Query()] = None,
    success: Annotated[bool | None, Query()] = None,
    failure_reason: Annotated[str | None, Query()] = None,
    username: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query()] = None,
    created_from: Annotated[datetime | None, Query()] = None,
    created_to: Annotated[datetime | None, Query()] = None,
) -> LoginHistoryListResponse:
    """Global admin login-history list with filters and pagination."""
    items, total = await service.list_history(
        event_type=event_type,
        success=success,
        failure_reason=failure_reason,
        username=username,
        q=q,
        created_from=created_from,
        created_to=created_to,
        offset=offset,
        limit=limit,
    )
    return LoginHistoryListResponse(
        data=[LoginHistoryResponse.from_model(row) for row in items],
        meta=PaginationMeta(offset=offset, limit=limit, total=total),
    )


@router.get(
    "/users/{user_id}/login-history",
    response_model=LoginHistoryListResponse,
    summary="List login history for a user (admin)",
)
async def list_user_login_history(
    user_id: UUID,
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(IdentityPermission.USERS_VIEW_LOGIN_HISTORY.value)),
    ],
    service: Annotated[LoginHistoryService, Depends(get_login_history_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    event_type: Annotated[str | None, Query()] = None,
    success: Annotated[bool | None, Query()] = None,
    failure_reason: Annotated[str | None, Query()] = None,
    username: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query()] = None,
    created_from: Annotated[datetime | None, Query()] = None,
    created_to: Annotated[datetime | None, Query()] = None,
) -> LoginHistoryListResponse:
    """Admin login-history list scoped to one user."""
    items, total = await service.list_history(
        user_id=user_id,
        event_type=event_type,
        success=success,
        failure_reason=failure_reason,
        username=username,
        q=q,
        created_from=created_from,
        created_to=created_to,
        offset=offset,
        limit=limit,
    )
    return LoginHistoryListResponse(
        data=[LoginHistoryResponse.from_model(row) for row in items],
        meta=PaginationMeta(offset=offset, limit=limit, total=total),
    )
