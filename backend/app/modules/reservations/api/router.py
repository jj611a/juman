"""Reservations HTTP API."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status

from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.rbac.dependencies import require_permission
from app.modules.reservations.constants import ReservationPermission, ReservationSortField
from app.modules.reservations.dependencies import get_reservation_service
from app.modules.reservations.schemas.reservation import (
    ReservationCreateRequest,
    ReservationItemEnvelope,
    ReservationListResponse,
    ReservationResponse,
    ReservationUpdateRequest,
)
from app.modules.reservations.services.reservation import ReservationService
from app.schemas.common import PaginationMeta

router = APIRouter(prefix="/reservations", tags=["Reservations"])


def _client_ip(request: Request) -> str | None:
    if request.client is None:  # pragma: no cover
        return None
    return request.client.host


@router.get(
    "",
    response_model=ReservationListResponse,
    summary="List reservations",
)
async def list_reservations(
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(ReservationPermission.VIEW.value)),
    ],
    service: Annotated[ReservationService, Depends(get_reservation_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    customer_id: Annotated[UUID | None, Query()] = None,
    rental_from: Annotated[datetime | None, Query()] = None,
    rental_to: Annotated[datetime | None, Query()] = None,
    sort_by: Annotated[ReservationSortField, Query()] = ReservationSortField.CREATED_AT,
    sort_dir: Annotated[str, Query(pattern="^(?i)(asc|desc)$")] = "desc",
) -> ReservationListResponse:
    """List live reservations with filters and pagination."""
    items, total = await service.list(
        status=status_filter,
        customer_id=customer_id,
        rental_from=rental_from,
        rental_to=rental_to,
        sort_by=sort_by,
        sort_dir=sort_dir,
        offset=offset,
        limit=limit,
    )
    return ReservationListResponse(
        data=[ReservationResponse.from_model(item) for item in items],
        meta=PaginationMeta(offset=offset, limit=limit, total=total),
    )


@router.get(
    "/{reservation_id}",
    response_model=ReservationItemEnvelope,
    summary="Get reservation by id",
)
async def get_reservation(
    reservation_id: UUID,
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(ReservationPermission.VIEW.value)),
    ],
    service: Annotated[ReservationService, Depends(get_reservation_service)],
) -> ReservationItemEnvelope:
    """Return a single reservation with items."""
    reservation = await service.get(reservation_id)
    return ReservationItemEnvelope(data=ReservationResponse.from_model(reservation))


@router.post(
    "",
    response_model=ReservationItemEnvelope,
    status_code=status.HTTP_201_CREATED,
    summary="Create draft reservation",
)
async def create_reservation(
    body: ReservationCreateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(ReservationPermission.CREATE.value)),
    ],
    service: Annotated[ReservationService, Depends(get_reservation_service)],
) -> ReservationItemEnvelope:
    """Create a Draft reservation (no calendar lock yet)."""
    reservation = await service.create(
        customer_id=body.customer_id,
        rental_start_at=body.rental_start_at,
        expected_return_at=body.expected_return_at,
        reservation_at=body.reservation_at,
        notes=body.notes,
        items=[item.model_dump() for item in body.items],
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return ReservationItemEnvelope(data=ReservationResponse.from_model(reservation))


@router.patch(
    "/{reservation_id}",
    response_model=ReservationItemEnvelope,
    summary="Update draft reservation",
)
async def update_reservation(
    reservation_id: UUID,
    body: ReservationUpdateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(ReservationPermission.UPDATE.value)),
    ],
    service: Annotated[ReservationService, Depends(get_reservation_service)],
) -> ReservationItemEnvelope:
    """Update a Draft reservation."""
    reservation = await service.update(
        reservation_id,
        customer_id=body.customer_id,
        reservation_at=body.reservation_at,
        rental_start_at=body.rental_start_at,
        expected_return_at=body.expected_return_at,
        notes=body.notes,
        clear_notes=body.clear_notes,
        items=[item.model_dump() for item in body.items] if body.items is not None else None,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return ReservationItemEnvelope(data=ReservationResponse.from_model(reservation))


@router.post(
    "/{reservation_id}/confirm",
    response_model=ReservationItemEnvelope,
    summary="Confirm reservation",
)
async def confirm_reservation(
    reservation_id: UUID,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(ReservationPermission.UPDATE.value)),
    ],
    service: Annotated[ReservationService, Depends(get_reservation_service)],
) -> ReservationItemEnvelope:
    """Confirm draft: calendar blocks + dress RESERVED."""
    reservation = await service.confirm(
        reservation_id,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return ReservationItemEnvelope(data=ReservationResponse.from_model(reservation))


@router.post(
    "/{reservation_id}/cancel",
    response_model=ReservationItemEnvelope,
    summary="Cancel reservation",
)
async def cancel_reservation(
    reservation_id: UUID,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(ReservationPermission.CANCEL.value)),
    ],
    service: Annotated[ReservationService, Depends(get_reservation_service)],
) -> ReservationItemEnvelope:
    """Cancel draft or confirmed reservation."""
    reservation = await service.cancel(
        reservation_id,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return ReservationItemEnvelope(data=ReservationResponse.from_model(reservation))


@router.post(
    "/{reservation_id}/expire",
    response_model=ReservationItemEnvelope,
    summary="Expire confirmed reservation",
)
async def expire_reservation(
    reservation_id: UUID,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(ReservationPermission.UPDATE.value)),
    ],
    service: Annotated[ReservationService, Depends(get_reservation_service)],
) -> ReservationItemEnvelope:
    """Expire a confirmed reservation and release holds."""
    reservation = await service.expire(
        reservation_id,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return ReservationItemEnvelope(data=ReservationResponse.from_model(reservation))
