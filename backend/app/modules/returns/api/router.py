"""Returns HTTP API."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status

from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.rbac.dependencies import require_permission
from app.modules.returns.constants import ReturnPermission, ReturnSortField
from app.modules.returns.dependencies import get_return_service
from app.modules.returns.schemas.return_record import (
    ReturnCreateRequest,
    ReturnItemEnvelope,
    ReturnListResponse,
    ReturnResponse,
)
from app.modules.returns.services.return_service import ReturnService
from app.schemas.common import PaginationMeta

router = APIRouter(prefix="/returns", tags=["Returns"])


def _client_ip(request: Request) -> str | None:
    if request.client is None:  # pragma: no cover
        return None
    return request.client.host


@router.get(
    "",
    response_model=ReturnListResponse,
    summary="List returns",
)
async def list_returns(
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(ReturnPermission.VIEW.value)),
    ],
    service: Annotated[ReturnService, Depends(get_return_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    customer_id: Annotated[UUID | None, Query()] = None,
    rental_id: Annotated[UUID | None, Query()] = None,
    sort_by: Annotated[ReturnSortField, Query()] = ReturnSortField.CREATED_AT,
    sort_dir: Annotated[str, Query(pattern="^(?i)(asc|desc)$")] = "desc",
) -> ReturnListResponse:
    """List live returns with filters and pagination."""
    items, total = await service.list(
        status=status_filter,
        customer_id=customer_id,
        rental_id=rental_id,
        sort_by=sort_by,
        sort_dir=sort_dir,
        offset=offset,
        limit=limit,
    )
    return ReturnListResponse(
        data=[ReturnResponse.from_model(item) for item in items],
        meta=PaginationMeta(offset=offset, limit=limit, total=total),
    )


@router.get(
    "/{return_id}",
    response_model=ReturnItemEnvelope,
    summary="Get return by id",
)
async def get_return(
    return_id: UUID,
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(ReturnPermission.VIEW.value)),
    ],
    service: Annotated[ReturnService, Depends(get_return_service)],
) -> ReturnItemEnvelope:
    """Return a single return record with items."""
    record = await service.get(return_id)
    return ReturnItemEnvelope(data=ReturnResponse.from_model(record))


@router.post(
    "",
    response_model=ReturnItemEnvelope,
    status_code=status.HTTP_201_CREATED,
    summary="Create return for an active rental",
)
async def create_return(
    body: ReturnCreateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(ReturnPermission.CREATE.value)),
    ],
    service: Annotated[ReturnService, Depends(get_return_service)],
) -> ReturnItemEnvelope:
    """Receive all dresses from an ACTIVE rental into PENDING_INSPECTION."""
    record = await service.create(
        rental_id=body.rental_id,
        customer_id=body.customer_id,
        returned_at=body.returned_at,
        notes=body.notes,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return ReturnItemEnvelope(data=ReturnResponse.from_model(record))
