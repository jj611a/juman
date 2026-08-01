"""Admin audit log HTTP endpoints (read-only)."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.modules.audit.constants import AuditPermission
from app.modules.audit.dependencies import get_audit_service
from app.modules.audit.schemas.audit_log import (
    AuditLogItemResponse,
    AuditLogListResponse,
    AuditLogResponse,
)
from app.modules.audit.services.audit_log import AuditService
from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.rbac.dependencies import require_permission
from app.schemas.common import PaginationMeta

router = APIRouter()


@router.get(
    "/logs",
    response_model=AuditLogListResponse,
    summary="List audit logs",
)
async def list_audit_logs(
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(AuditPermission.VIEW.value)),
    ],
    service: Annotated[AuditService, Depends(get_audit_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    module: Annotated[str | None, Query()] = None,
    entity_type: Annotated[str | None, Query()] = None,
    entity_id: Annotated[str | None, Query()] = None,
    action: Annotated[str | None, Query()] = None,
    user_id: Annotated[UUID | None, Query()] = None,
    username: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query()] = None,
    created_from: Annotated[datetime | None, Query()] = None,
    created_to: Annotated[datetime | None, Query()] = None,
) -> AuditLogListResponse:
    """List enterprise audit logs with filters (admin)."""
    items, total = await service.list_logs(
        module=module,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        user_id=user_id,
        username=username,
        q=q,
        created_from=created_from,
        created_to=created_to,
        offset=offset,
        limit=limit,
    )
    return AuditLogListResponse(
        data=[AuditLogResponse.from_model(row) for row in items],
        meta=PaginationMeta(offset=offset, limit=limit, total=total),
    )


@router.get(
    "/logs/{audit_id}",
    response_model=AuditLogItemResponse,
    summary="Get audit log by id",
)
async def get_audit_log(
    audit_id: UUID,
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(AuditPermission.VIEW.value)),
    ],
    service: Annotated[AuditService, Depends(get_audit_service)],
) -> AuditLogItemResponse:
    """Return a single audit log entry."""
    row = await service.get_log(audit_id)
    return AuditLogItemResponse(data=AuditLogResponse.from_model(row))
