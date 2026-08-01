"""Processing HTTP API."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status

from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.processing.constants import ProcessingPermission, ProcessingSortField
from app.modules.processing.dependencies import get_processing_service
from app.modules.processing.schemas.processing import (
    ProcessingCreateRequest,
    ProcessingItemEnvelope,
    ProcessingListResponse,
    ProcessingResponse,
    ProcessingStartRequest,
    ProcessingUpdateRequest,
)
from app.modules.processing.services.processing import ProcessingService
from app.modules.rbac.dependencies import require_permission
from app.schemas.common import PaginationMeta

router = APIRouter(prefix="/processing", tags=["Processing"])


def _client_ip(request: Request) -> str | None:
    if request.client is None:  # pragma: no cover
        return None
    return request.client.host


@router.get(
    "",
    response_model=ProcessingListResponse,
    summary="List processing batches",
)
async def list_processing(
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(ProcessingPermission.VIEW.value)),
    ],
    service: Annotated[ProcessingService, Depends(get_processing_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    dress_id: Annotated[UUID | None, Query()] = None,
    sort_by: Annotated[ProcessingSortField, Query()] = ProcessingSortField.CREATED_AT,
    sort_dir: Annotated[str, Query(pattern="^(?i)(asc|desc)$")] = "desc",
) -> ProcessingListResponse:
    items, total = await service.list(
        status=status_filter,
        dress_id=dress_id,
        sort_by=sort_by,
        sort_dir=sort_dir,
        offset=offset,
        limit=limit,
    )
    return ProcessingListResponse(
        data=[ProcessingResponse.from_model(item) for item in items],
        meta=PaginationMeta(offset=offset, limit=limit, total=total),
    )


@router.get(
    "/{batch_id}",
    response_model=ProcessingItemEnvelope,
    summary="Get processing batch by id",
)
async def get_processing(
    batch_id: UUID,
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(ProcessingPermission.VIEW.value)),
    ],
    service: Annotated[ProcessingService, Depends(get_processing_service)],
) -> ProcessingItemEnvelope:
    record = await service.get(batch_id)
    return ProcessingItemEnvelope(data=ProcessingResponse.from_model(record))


@router.post(
    "",
    response_model=ProcessingItemEnvelope,
    status_code=status.HTTP_201_CREATED,
    summary="Create PENDING processing batch",
)
async def create_processing(
    body: ProcessingCreateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(ProcessingPermission.CREATE.value)),
    ],
    service: Annotated[ProcessingService, Depends(get_processing_service)],
) -> ProcessingItemEnvelope:
    record = await service.create(
        inspection_item_ids=body.inspection_item_ids,
        notes=body.notes,
        enable_optional_day=body.enable_optional_day,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return ProcessingItemEnvelope(data=ProcessingResponse.from_model(record))


@router.patch(
    "/{batch_id}",
    response_model=ProcessingItemEnvelope,
    summary="Update processing batch notes",
)
async def update_processing(
    batch_id: UUID,
    body: ProcessingUpdateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(ProcessingPermission.UPDATE.value)),
    ],
    service: Annotated[ProcessingService, Depends(get_processing_service)],
) -> ProcessingItemEnvelope:
    record = await service.update(
        batch_id,
        notes=body.notes,
        clear_notes=body.clear_notes,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return ProcessingItemEnvelope(data=ProcessingResponse.from_model(record))


@router.post(
    "/{batch_id}/start",
    response_model=ProcessingItemEnvelope,
    summary="Start PENDING processing batch",
)
async def start_processing(
    batch_id: UUID,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(ProcessingPermission.CREATE.value)),
    ],
    service: Annotated[ProcessingService, Depends(get_processing_service)],
    body: ProcessingStartRequest | None = None,
) -> ProcessingItemEnvelope:
    payload = body or ProcessingStartRequest()
    record = await service.start(
        batch_id,
        enable_optional_day=payload.enable_optional_day,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return ProcessingItemEnvelope(data=ProcessingResponse.from_model(record))


@router.post(
    "/{batch_id}/add-optional-day",
    response_model=ProcessingItemEnvelope,
    summary="Enable optional processing day",
)
async def add_optional_day(
    batch_id: UUID,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(ProcessingPermission.UPDATE.value)),
    ],
    service: Annotated[ProcessingService, Depends(get_processing_service)],
) -> ProcessingItemEnvelope:
    record = await service.add_optional_day(
        batch_id,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return ProcessingItemEnvelope(data=ProcessingResponse.from_model(record))


@router.post(
    "/{batch_id}/complete",
    response_model=ProcessingItemEnvelope,
    summary="Complete IN_PROCESS processing batch",
)
async def complete_processing(
    batch_id: UUID,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(ProcessingPermission.COMPLETE.value)),
    ],
    service: Annotated[ProcessingService, Depends(get_processing_service)],
) -> ProcessingItemEnvelope:
    record = await service.complete(
        batch_id,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return ProcessingItemEnvelope(data=ProcessingResponse.from_model(record))
