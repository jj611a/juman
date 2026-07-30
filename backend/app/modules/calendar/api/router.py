"""Calendar HTTP API."""

from datetime import datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status

from app.modules.calendar.constants import CalendarPermission
from app.modules.calendar.dependencies import get_calendar_service
from app.modules.calendar.schemas.calendar import (
    AvailabilityData,
    AvailabilityResponse,
    CalendarBlockCreateRequest,
    CalendarBlockItemResponse,
    CalendarBlockListResponse,
    CalendarBlockResponse,
    CalendarBlockUpdateRequest,
    CalendarConflictItem,
    ConflictsData,
    ConflictsResponse,
    MessageOnlyResponse,
    NextAvailableData,
    NextAvailableResponse,
)
from app.modules.calendar.services.calendar import CalendarService
from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.rbac.dependencies import require_permission

router = APIRouter(prefix="/calendar", tags=["Calendar"])


def _client_ip(request: Request) -> str | None:
    if request.client is None:  # pragma: no cover - ASGI always provides client in tests
        return None
    return request.client.host


@router.get(
    "/dress/{dress_id}",
    response_model=CalendarBlockListResponse,
    summary="Dress calendar timeline",
)
async def get_dress_timeline(
    dress_id: UUID,
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CalendarPermission.VIEW.value)),
    ],
    service: Annotated[CalendarService, Depends(get_calendar_service)],
    window_from: Annotated[datetime | None, Query(alias="from")] = None,
    window_to: Annotated[datetime | None, Query(alias="to")] = None,
) -> CalendarBlockListResponse:
    """List live calendar blocks for a dress."""
    items = await service.get_timeline(
        dress_id,
        window_from=window_from,
        window_to=window_to,
    )
    return CalendarBlockListResponse(
        data=[CalendarBlockResponse.from_model(item) for item in items]
    )


@router.get(
    "/dress/{dress_id}/availability",
    response_model=AvailabilityResponse,
    summary="Check dress interval availability",
)
async def check_availability(
    dress_id: UUID,
    start_at: Annotated[datetime, Query()],
    end_at: Annotated[datetime, Query()],
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CalendarPermission.VIEW.value)),
    ],
    service: Annotated[CalendarService, Depends(get_calendar_service)],
) -> AvailabilityResponse:
    """Return whether the dress is free for [start_at, end_at)."""
    available = await service.is_available(dress_id, start_at, end_at)
    return AvailabilityResponse(
        data=AvailabilityData(
            dress_id=dress_id,
            start_at=start_at,
            end_at=end_at,
            available=available,
        )
    )


@router.get(
    "/dress/{dress_id}/availability/next",
    response_model=NextAvailableResponse,
    summary="Next available start for a duration",
)
async def next_availability(
    dress_id: UUID,
    after: Annotated[datetime, Query()],
    duration_seconds: Annotated[int, Query(ge=1, le=31_536_000)],
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CalendarPermission.VIEW.value)),
    ],
    service: Annotated[CalendarService, Depends(get_calendar_service)],
) -> NextAvailableResponse:
    """Find the earliest start time for a free interval of the given duration."""
    nxt = await service.next_available_date(
        dress_id,
        after=after,
        duration=timedelta(seconds=duration_seconds),
    )
    return NextAvailableResponse(
        data=NextAvailableData(
            dress_id=dress_id,
            after=after,
            duration_seconds=duration_seconds,
            next_available_start=nxt,
        )
    )


@router.get(
    "/dress/{dress_id}/conflicts",
    response_model=ConflictsResponse,
    summary="List conflicts for an interval",
)
async def list_conflicts(
    dress_id: UUID,
    start_at: Annotated[datetime, Query()],
    end_at: Annotated[datetime, Query()],
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CalendarPermission.VIEW.value)),
    ],
    service: Annotated[CalendarService, Depends(get_calendar_service)],
) -> ConflictsResponse:
    """Return overlapping blocks for a proposed interval."""
    conflicts = await service.get_conflicts(dress_id, start_at, end_at)
    return ConflictsResponse(
        data=ConflictsData(
            dress_id=dress_id,
            start_at=start_at,
            end_at=end_at,
            conflicts=[
                CalendarConflictItem(
                    block_id=c.block_id,
                    block_type=c.block_type,
                    start_at=c.start_at,
                    end_at=c.end_at,
                    reference_module=c.reference_module,
                    reference_id=c.reference_id,
                    conflict_kind=c.conflict_kind,
                )
                for c in conflicts
            ],
        )
    )


@router.post(
    "/block",
    response_model=CalendarBlockItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create calendar block",
)
async def create_block(
    body: CalendarBlockCreateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CalendarPermission.MANAGE.value)),
    ],
    service: Annotated[CalendarService, Depends(get_calendar_service)],
) -> CalendarBlockItemResponse:
    """Create a busy block on a dress timeline."""
    block = await service.create_block(
        dress_id=body.dress_id,
        block_type=body.block_type,
        start_at=body.start_at,
        end_at=body.end_at,
        reference_module=body.reference_module,
        reference_id=body.reference_id,
        notes=body.notes,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return CalendarBlockItemResponse(data=CalendarBlockResponse.from_model(block))


@router.patch(
    "/block/{block_id}",
    response_model=CalendarBlockItemResponse,
    summary="Update / move calendar block",
)
async def update_block(
    block_id: UUID,
    body: CalendarBlockUpdateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CalendarPermission.MANAGE.value)),
    ],
    service: Annotated[CalendarService, Depends(get_calendar_service)],
) -> CalendarBlockItemResponse:
    """Move a block or update notes / type."""
    block = await service.move_block(
        block_id,
        start_at=body.start_at,
        end_at=body.end_at,
        block_type=body.block_type,
        notes=body.notes,
        clear_notes=body.clear_notes,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return CalendarBlockItemResponse(data=CalendarBlockResponse.from_model(block))


@router.delete(
    "/block/{block_id}",
    response_model=MessageOnlyResponse,
    summary="Delete calendar block",
)
async def delete_block(
    block_id: UUID,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CalendarPermission.MANAGE.value)),
    ],
    service: Annotated[CalendarService, Depends(get_calendar_service)],
) -> MessageOnlyResponse:
    """Soft-delete a calendar block."""
    await service.remove_block(
        block_id,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return MessageOnlyResponse(message="تم حذف كتلة التقويم")
