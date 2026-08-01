"""Inspection HTTP API."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status

from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.inspection.constants import InspectionPermission, InspectionSortField
from app.modules.inspection.dependencies import get_inspection_service
from app.modules.inspection.schemas.inspection import (
    InspectionCreateRequest,
    InspectionItemEnvelope,
    InspectionListResponse,
    InspectionResponse,
    InspectionUpdateRequest,
)
from app.modules.inspection.services.inspection import InspectionService
from app.modules.rbac.dependencies import require_permission
from app.schemas.common import PaginationMeta

router = APIRouter(prefix="/inspections", tags=["Inspection"])


def _client_ip(request: Request) -> str | None:
    if request.client is None:  # pragma: no cover
        return None
    return request.client.host


@router.get(
    "",
    response_model=InspectionListResponse,
    summary="List inspections",
)
async def list_inspections(
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(InspectionPermission.VIEW.value)),
    ],
    service: Annotated[InspectionService, Depends(get_inspection_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    return_id: Annotated[UUID | None, Query()] = None,
    sort_by: Annotated[InspectionSortField, Query()] = InspectionSortField.CREATED_AT,
    sort_dir: Annotated[str, Query(pattern="^(?i)(asc|desc)$")] = "desc",
) -> InspectionListResponse:
    items, total = await service.list(
        status=status_filter,
        return_id=return_id,
        sort_by=sort_by,
        sort_dir=sort_dir,
        offset=offset,
        limit=limit,
    )
    return InspectionListResponse(
        data=[InspectionResponse.from_model(item) for item in items],
        meta=PaginationMeta(offset=offset, limit=limit, total=total),
    )


@router.get(
    "/{inspection_id}",
    response_model=InspectionItemEnvelope,
    summary="Get inspection by id",
)
async def get_inspection(
    inspection_id: UUID,
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(InspectionPermission.VIEW.value)),
    ],
    service: Annotated[InspectionService, Depends(get_inspection_service)],
) -> InspectionItemEnvelope:
    record = await service.get(inspection_id)
    return InspectionItemEnvelope(data=InspectionResponse.from_model(record))


@router.post(
    "",
    response_model=InspectionItemEnvelope,
    status_code=status.HTTP_201_CREATED,
    summary="Create PENDING inspection for a return",
)
async def create_inspection(
    body: InspectionCreateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(InspectionPermission.CREATE.value)),
    ],
    service: Annotated[InspectionService, Depends(get_inspection_service)],
) -> InspectionItemEnvelope:
    record = await service.create(
        return_id=body.return_id,
        notes=body.notes,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return InspectionItemEnvelope(data=InspectionResponse.from_model(record))


@router.patch(
    "/{inspection_id}",
    response_model=InspectionItemEnvelope,
    summary="Update or complete PENDING inspection",
)
async def update_inspection(
    inspection_id: UUID,
    body: InspectionUpdateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(InspectionPermission.UPDATE.value)),
    ],
    service: Annotated[InspectionService, Depends(get_inspection_service)],
) -> InspectionItemEnvelope:
    record = await service.update(
        inspection_id,
        notes=body.notes,
        clear_notes=body.clear_notes,
        items=[item.model_dump() for item in body.items] if body.items is not None else None,
        complete=body.complete,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return InspectionItemEnvelope(data=InspectionResponse.from_model(record))
