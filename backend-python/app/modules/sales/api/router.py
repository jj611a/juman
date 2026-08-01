"""Sales HTTP API."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status

from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.rbac.dependencies import require_permission
from app.modules.sales.constants import SalePermission, SaleSortField
from app.modules.sales.dependencies import get_sale_service
from app.modules.sales.schemas.sale import (
    SaleCreateRequest,
    SaleItemEnvelope,
    SaleListResponse,
    SaleResponse,
)
from app.modules.sales.services.sale import SaleService
from app.schemas.common import PaginationMeta

router = APIRouter(prefix="/sales", tags=["Sales"])


def _client_ip(request: Request) -> str | None:
    if request.client is None:  # pragma: no cover
        return None
    return request.client.host


@router.get(
    "",
    response_model=SaleListResponse,
    summary="List sales",
)
async def list_sales(
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(SalePermission.VIEW.value)),
    ],
    service: Annotated[SaleService, Depends(get_sale_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    origin: Annotated[str | None, Query()] = None,
    customer_id: Annotated[UUID | None, Query()] = None,
    sort_by: Annotated[SaleSortField, Query()] = SaleSortField.CREATED_AT,
    sort_dir: Annotated[str, Query(pattern="^(?i)(asc|desc)$")] = "desc",
) -> SaleListResponse:
    items, total = await service.list(
        status=status_filter,
        origin=origin,
        customer_id=customer_id,
        sort_by=sort_by,
        sort_dir=sort_dir,
        offset=offset,
        limit=limit,
    )
    return SaleListResponse(
        data=[SaleResponse.from_model(item) for item in items],
        meta=PaginationMeta(offset=offset, limit=limit, total=total),
    )


@router.get(
    "/{sale_id}",
    response_model=SaleItemEnvelope,
    summary="Get sale by id",
)
async def get_sale(
    sale_id: UUID,
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(SalePermission.VIEW.value)),
    ],
    service: Annotated[SaleService, Depends(get_sale_service)],
) -> SaleItemEnvelope:
    record = await service.get(sale_id)
    return SaleItemEnvelope(data=SaleResponse.from_model(record))


@router.post(
    "",
    response_model=SaleItemEnvelope,
    status_code=status.HTTP_201_CREATED,
    summary="Create completed sale",
)
async def create_sale(
    body: SaleCreateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(SalePermission.CREATE.value)),
    ],
    service: Annotated[SaleService, Depends(get_sale_service)],
) -> SaleItemEnvelope:
    record = await service.create(
        origin=body.origin,
        customer_id=body.customer_id,
        inspection_item_id=body.inspection_item_id,
        items=body.items,
        payment=body.payment,
        notes=body.notes,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return SaleItemEnvelope(data=SaleResponse.from_model(record))

