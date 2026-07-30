"""Rentals HTTP API."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status

from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.rbac.dependencies import require_permission
from app.modules.rentals.constants import RentalPermission, RentalSortField
from app.modules.rentals.dependencies import get_rental_service
from app.modules.rentals.schemas.rental import (
    RentalCreateRequest,
    RentalItemEnvelope,
    RentalListResponse,
    RentalResponse,
    RentalUpdateRequest,
)
from app.modules.rentals.services.rental import RentalService
from app.schemas.common import PaginationMeta

router = APIRouter(prefix="/rentals", tags=["Rentals"])


def _client_ip(request: Request) -> str | None:
    if request.client is None:  # pragma: no cover
        return None
    return request.client.host


@router.get(
    "",
    response_model=RentalListResponse,
    summary="List rentals",
)
async def list_rentals(
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(RentalPermission.VIEW.value)),
    ],
    service: Annotated[RentalService, Depends(get_rental_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    customer_id: Annotated[UUID | None, Query()] = None,
    reservation_id: Annotated[UUID | None, Query()] = None,
    sort_by: Annotated[RentalSortField, Query()] = RentalSortField.CREATED_AT,
    sort_dir: Annotated[str, Query(pattern="^(?i)(asc|desc)$")] = "desc",
) -> RentalListResponse:
    """List live rentals with filters and pagination."""
    items, total = await service.list(
        status=status_filter,
        customer_id=customer_id,
        reservation_id=reservation_id,
        sort_by=sort_by,
        sort_dir=sort_dir,
        offset=offset,
        limit=limit,
    )
    return RentalListResponse(
        data=[RentalResponse.from_model(item) for item in items],
        meta=PaginationMeta(offset=offset, limit=limit, total=total),
    )


@router.get(
    "/{rental_id}",
    response_model=RentalItemEnvelope,
    summary="Get rental by id",
)
async def get_rental(
    rental_id: UUID,
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(RentalPermission.VIEW.value)),
    ],
    service: Annotated[RentalService, Depends(get_rental_service)],
) -> RentalItemEnvelope:
    """Return a single rental with items."""
    rental = await service.get(rental_id)
    return RentalItemEnvelope(data=RentalResponse.from_model(rental))


@router.post(
    "",
    response_model=RentalItemEnvelope,
    status_code=status.HTTP_201_CREATED,
    summary="Create rental (walk-in or from reservation)",
)
async def create_rental(
    body: RentalCreateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(RentalPermission.CREATE.value)),
    ],
    service: Annotated[RentalService, Depends(get_rental_service)],
) -> RentalItemEnvelope:
    """Create an Active rental with initial payment snapshot."""
    rental = await service.create(
        customer_id=body.customer_id,
        expected_return_at=body.expected_return_at,
        initial_payment_type=body.initial_payment_type,
        rental_at=body.rental_at,
        reservation_id=body.reservation_id,
        initial_payment_value=body.initial_payment_value,
        initial_payment_rate=body.initial_payment_rate,
        notes=body.notes,
        items=[item.model_dump() for item in body.items] if body.items is not None else None,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return RentalItemEnvelope(data=RentalResponse.from_model(rental))


@router.patch(
    "/{rental_id}",
    response_model=RentalItemEnvelope,
    summary="Update rental notes",
)
async def update_rental(
    rental_id: UUID,
    body: RentalUpdateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(RentalPermission.UPDATE.value)),
    ],
    service: Annotated[RentalService, Depends(get_rental_service)],
) -> RentalItemEnvelope:
    """Update notes on an Active rental."""
    rental = await service.update(
        rental_id,
        notes=body.notes,
        clear_notes=body.clear_notes,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return RentalItemEnvelope(data=RentalResponse.from_model(rental))


@router.post(
    "/{rental_id}/cancel",
    response_model=RentalItemEnvelope,
    summary="Cancel rental (rejected in v1)",
)
async def cancel_rental(
    rental_id: UUID,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(RentalPermission.CANCEL.value)),
    ],
    service: Annotated[RentalService, Depends(get_rental_service)],
) -> RentalItemEnvelope:
    """Always rejected after handover — Returns module owns reverse."""
    await service.cancel(
        rental_id,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    raise AssertionError("cancel must raise ValidationError")  # pragma: no cover
