"""CRUD endpoints for roles and permissions."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.modules.rbac.dependencies import (
    get_permission_service,
    get_role_service,
    require_any_permission,
    require_permission,
)
from app.modules.rbac.schemas.permission import (
    PermissionCreateRequest,
    PermissionListResponse,
    PermissionResponse,
    PermissionUpdateRequest,
)
from app.modules.rbac.schemas.role import (
    RoleCreateRequest,
    RoleListResponse,
    RolePermissionAssignRequest,
    RoleResponse,
    RoleUpdateRequest,
)
from app.modules.rbac.services.permission import PermissionService
from app.modules.rbac.services.role import RoleService
from app.schemas.common import APIModel, MessageResponse

router = APIRouter(tags=["RBAC"])


class PermissionItemResponse(APIModel):
    """Single permission envelope."""

    success: bool = True
    item: PermissionResponse


class RoleItemResponse(APIModel):
    """Single role envelope."""

    success: bool = True
    item: RoleResponse


def _permission_response(permission) -> PermissionResponse:
    return PermissionResponse.model_validate(permission)


async def _role_response(service: RoleService, role) -> RoleResponse:
    permissions = await service.list_role_permissions(role.id)
    payload = RoleResponse.model_validate(role)
    return payload.model_copy(
        update={"permissions": [_permission_response(p) for p in permissions]}
    )


@router.get(
    "/permissions",
    response_model=PermissionListResponse,
    summary="List permissions",
    dependencies=[Depends(require_permission("permissions.view"))],
)
async def list_permissions(
    service: Annotated[PermissionService, Depends(get_permission_service)],
    module: Annotated[str | None, Query(description="Filter by module")] = None,
) -> PermissionListResponse:
    """Return all active permissions."""
    items = await service.list_permissions(module=module)
    return PermissionListResponse(
        total=len(items),
        items=[_permission_response(item) for item in items],
    )


@router.get(
    "/permissions/by-key/{key}",
    response_model=PermissionItemResponse,
    summary="Get permission by key",
    dependencies=[Depends(require_permission("permissions.view"))],
)
async def get_permission_by_key(
    key: str,
    service: Annotated[PermissionService, Depends(get_permission_service)],
) -> PermissionItemResponse:
    """Lookup a permission using its dot-notation key."""
    permission = await service.get_by_key(key)
    return PermissionItemResponse(item=_permission_response(permission))


@router.get(
    "/permissions/{permission_id}",
    response_model=PermissionItemResponse,
    summary="Get permission by id",
    dependencies=[Depends(require_permission("permissions.view"))],
)
async def get_permission(
    permission_id: UUID,
    service: Annotated[PermissionService, Depends(get_permission_service)],
) -> PermissionItemResponse:
    """Return a permission by UUID."""
    permission = await service.get_by_id(permission_id)
    return PermissionItemResponse(item=_permission_response(permission))


@router.post(
    "/permissions",
    response_model=PermissionItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create permission",
    dependencies=[Depends(require_permission("permissions.manage"))],
)
async def create_permission(
    body: PermissionCreateRequest,
    service: Annotated[PermissionService, Depends(get_permission_service)],
) -> PermissionItemResponse:
    """Create a new permission definition."""
    permission = await service.create_permission(
        key=body.key,
        display_name=body.display_name,
        description=body.description,
        module=body.module,
    )
    return PermissionItemResponse(item=_permission_response(permission))


@router.put(
    "/permissions/{permission_id}",
    response_model=PermissionItemResponse,
    summary="Update permission",
    dependencies=[Depends(require_permission("permissions.manage"))],
)
async def update_permission(
    permission_id: UUID,
    body: PermissionUpdateRequest,
    service: Annotated[PermissionService, Depends(get_permission_service)],
) -> PermissionItemResponse:
    """Update display name, description, or module."""
    permission = await service.update_permission(
        permission_id,
        display_name=body.display_name,
        description=body.description,
        module=body.module,
    )
    return PermissionItemResponse(item=_permission_response(permission))


@router.delete(
    "/permissions/{permission_id}",
    response_model=MessageResponse,
    summary="Delete permission",
    dependencies=[Depends(require_permission("permissions.manage"))],
)
async def delete_permission(
    permission_id: UUID,
    service: Annotated[PermissionService, Depends(get_permission_service)],
) -> MessageResponse:
    """Soft-delete a permission."""
    await service.delete_permission(permission_id)
    return MessageResponse(message="تم حذف الصلاحية")


@router.get(
    "/roles",
    response_model=RoleListResponse,
    summary="List roles",
    dependencies=[Depends(require_permission("roles.view"))],
)
async def list_roles(
    service: Annotated[RoleService, Depends(get_role_service)],
    active_only: Annotated[bool, Query()] = False,
) -> RoleListResponse:
    """Return roles, optionally only active ones."""
    roles = await service.list_roles(active_only=active_only)
    items = [await _role_response(service, role) for role in roles]
    return RoleListResponse(total=len(items), items=items)


@router.get(
    "/roles/{role_id}",
    response_model=RoleItemResponse,
    summary="Get role by id",
    dependencies=[Depends(require_permission("roles.view"))],
)
async def get_role(
    role_id: UUID,
    service: Annotated[RoleService, Depends(get_role_service)],
) -> RoleItemResponse:
    """Return a role with its assigned permissions."""
    role = await service.get_by_id(role_id)
    return RoleItemResponse(item=await _role_response(service, role))


@router.post(
    "/roles",
    response_model=RoleItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create role",
    dependencies=[
        Depends(require_any_permission("roles.create", "roles.manage")),
    ],
)
async def create_role(
    body: RoleCreateRequest,
    service: Annotated[RoleService, Depends(get_role_service)],
) -> RoleItemResponse:
    """Create a custom role and optionally assign permissions."""
    role = await service.create_role(
        name=body.name,
        description=body.description,
        is_active=body.is_active,
        permission_keys=body.permission_keys or None,
    )
    return RoleItemResponse(item=await _role_response(service, role))


@router.put(
    "/roles/{role_id}",
    response_model=RoleItemResponse,
    summary="Update role",
    dependencies=[
        Depends(require_any_permission("roles.update", "roles.manage")),
    ],
)
async def update_role(
    role_id: UUID,
    body: RoleUpdateRequest,
    service: Annotated[RoleService, Depends(get_role_service)],
) -> RoleItemResponse:
    """Update role metadata."""
    role = await service.update_role(
        role_id,
        name=body.name,
        description=body.description,
        is_active=body.is_active,
    )
    return RoleItemResponse(item=await _role_response(service, role))


@router.delete(
    "/roles/{role_id}",
    response_model=MessageResponse,
    summary="Delete role",
    dependencies=[
        Depends(require_any_permission("roles.delete", "roles.manage")),
    ],
)
async def delete_role(
    role_id: UUID,
    service: Annotated[RoleService, Depends(get_role_service)],
) -> MessageResponse:
    """Soft-delete a non-system role."""
    await service.delete_role(role_id)
    return MessageResponse(message="تم حذف الدور")


@router.get(
    "/roles/{role_id}/permissions",
    response_model=PermissionListResponse,
    summary="List role permissions",
    dependencies=[Depends(require_permission("roles.view"))],
)
async def list_role_permissions(
    role_id: UUID,
    service: Annotated[RoleService, Depends(get_role_service)],
) -> PermissionListResponse:
    """List permissions assigned to a role."""
    items = await service.list_role_permissions(role_id)
    return PermissionListResponse(
        total=len(items),
        items=[_permission_response(item) for item in items],
    )


@router.post(
    "/roles/{role_id}/permissions",
    response_model=PermissionListResponse,
    summary="Assign permissions to role",
    dependencies=[
        Depends(require_any_permission("roles.update", "roles.manage")),
    ],
)
async def assign_role_permissions(
    role_id: UUID,
    body: RolePermissionAssignRequest,
    service: Annotated[RoleService, Depends(get_role_service)],
) -> PermissionListResponse:
    """Assign one or more permission keys to a role."""
    items = await service.assign_permissions(role_id, body.permission_keys)
    return PermissionListResponse(
        total=len(items),
        items=[_permission_response(item) for item in items],
    )


@router.delete(
    "/roles/{role_id}/permissions/{permission_id}",
    response_model=MessageResponse,
    summary="Remove permission from role",
    dependencies=[
        Depends(require_any_permission("roles.update", "roles.manage")),
    ],
)
async def remove_role_permission(
    role_id: UUID,
    permission_id: UUID,
    service: Annotated[RoleService, Depends(get_role_service)],
) -> MessageResponse:
    """Remove a permission assignment from a role."""
    await service.remove_permission(role_id, permission_id)
    return MessageResponse(message="تم إزالة الصلاحية من الدور")
