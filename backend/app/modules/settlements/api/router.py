"""Settlement HTTP API."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status

from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.rbac.dependencies import require_permission
from app.modules.settlements.constants import SettlementPermission, SettlementSortField
from app.modules.settlements.dependencies import get_settlement_service
from app.modules.settlements.schemas.settlement import (
    SettlementAdjustmentRequest,
    SettlementCreateRequest,
    SettlementItemEnvelope,
    SettlementListResponse,
    SettlementPaymentRequest,
    SettlementResponse,
)
from app.modules.settlements.services.settlement import SettlementService
from app.schemas.common import PaginationMeta

router = APIRouter(prefix="/rental-settlements", tags=["Rental Settlements"])
rental_settlement_router = APIRouter(prefix="/rentals", tags=["Rental Settlements"])


def _client_ip(request: Request) -> str | None:
    if request.client is None:  # pragma: no cover
        return None
    return request.client.host


@router.get(
    "",
    response_model=SettlementListResponse,
    summary="List rental settlements",
)
async def list_settlements(
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(SettlementPermission.VIEW.value)),
    ],
    service: Annotated[SettlementService, Depends(get_settlement_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    rental_id: Annotated[UUID | None, Query()] = None,
    sort_by: Annotated[SettlementSortField, Query()] = SettlementSortField.CREATED_AT,
    sort_dir: Annotated[str, Query(pattern="^(?i)(asc|desc)$")] = "desc",
) -> SettlementListResponse:
    items, total = await service.list(
        status=status_filter,
        rental_id=rental_id,
        sort_by=sort_by,
        sort_dir=sort_dir,
        offset=offset,
        limit=limit,
    )
    return SettlementListResponse(
        data=[SettlementResponse.from_model(item) for item in items],
        meta=PaginationMeta(offset=offset, limit=limit, total=total),
    )


@router.get(
    "/{settlement_id}",
    response_model=SettlementItemEnvelope,
    summary="Get rental settlement by id",
)
async def get_settlement(
    settlement_id: UUID,
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(SettlementPermission.VIEW.value)),
    ],
    service: Annotated[SettlementService, Depends(get_settlement_service)],
) -> SettlementItemEnvelope:
    record = await service.get(settlement_id)
    return SettlementItemEnvelope(data=SettlementResponse.from_model(record))


@router.post(
    "",
    response_model=SettlementItemEnvelope,
    status_code=status.HTTP_201_CREATED,
    summary="Create rental settlement",
)
async def create_settlement(
    body: SettlementCreateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(SettlementPermission.CREATE.value)),
    ],
    service: Annotated[SettlementService, Depends(get_settlement_service)],
) -> SettlementItemEnvelope:
    record = await service.create(
        rental_id=body.rental_id,
        notes=body.notes,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return SettlementItemEnvelope(data=SettlementResponse.from_model(record))


@router.post(
    "/{settlement_id}/payments",
    response_model=SettlementItemEnvelope,
    status_code=status.HTTP_201_CREATED,
    summary="Record settlement payment",
)
async def add_settlement_payment(
    settlement_id: UUID,
    body: SettlementPaymentRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(SettlementPermission.COLLECT.value)),
    ],
    service: Annotated[SettlementService, Depends(get_settlement_service)],
) -> SettlementItemEnvelope:
    record = await service.add_payment(
        settlement_id,
        amount=body.amount,
        method=body.payment_method,
        reference_number=body.reference_number,
        notes=body.notes,
        received_at=body.received_at,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return SettlementItemEnvelope(data=SettlementResponse.from_model(record))


@router.post(
    "/{settlement_id}/adjustments",
    response_model=SettlementItemEnvelope,
    status_code=status.HTTP_201_CREATED,
    summary="Record settlement adjustment",
)
async def add_settlement_adjustment(
    settlement_id: UUID,
    body: SettlementAdjustmentRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(SettlementPermission.ADJUST.value)),
    ],
    service: Annotated[SettlementService, Depends(get_settlement_service)],
) -> SettlementItemEnvelope:
    record = await service.add_adjustment(
        settlement_id,
        amount=body.amount,
        reason=body.reason,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return SettlementItemEnvelope(data=SettlementResponse.from_model(record))


@rental_settlement_router.get(
    "/{rental_id}/settlement",
    response_model=SettlementItemEnvelope,
    summary="Get live settlement for a rental",
)
async def get_settlement_by_rental(
    rental_id: UUID,
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(SettlementPermission.VIEW.value)),
    ],
    service: Annotated[SettlementService, Depends(get_settlement_service)],
) -> SettlementItemEnvelope:
    record = await service.get_by_rental(rental_id)
    return SettlementItemEnvelope(data=SettlementResponse.from_model(record))
