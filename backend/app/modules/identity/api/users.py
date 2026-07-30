"""Admin user management HTTP endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.modules.identity.constants import IdentityPermission
from app.modules.identity.dependencies import get_user_service
from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.identity.schemas.user import (
    MessageOnlyResponse,
    UserCreateRequest,
    UserItemResponse,
    UserListResponse,
    UserResponse,
    UserUpdateRequest,
)
from app.modules.identity.services.user import UserService
from app.modules.rbac.dependencies import require_any_permission
from app.schemas.common import PaginationMeta

router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "",
    response_model=UserListResponse,
    summary="List users",
)
async def list_users(
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(
            require_any_permission(
                IdentityPermission.USERS_VIEW.value,
                IdentityPermission.USERS_MANAGE.value,
            )
        ),
    ],
    service: Annotated[UserService, Depends(get_user_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> UserListResponse:
    """List active (non-deleted) users."""
    items, total = await service.list_users(offset=offset, limit=limit)
    return UserListResponse(
        data=[UserResponse.from_model(user) for user in items],
        meta=PaginationMeta(offset=offset, limit=limit, total=total),
    )


@router.get(
    "/{user_id}",
    response_model=UserItemResponse,
    summary="Get user by id",
)
async def get_user(
    user_id: UUID,
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(
            require_any_permission(
                IdentityPermission.USERS_VIEW.value,
                IdentityPermission.USERS_MANAGE.value,
            )
        ),
    ],
    service: Annotated[UserService, Depends(get_user_service)],
) -> UserItemResponse:
    """Return a single user."""
    user = await service.get_user(user_id)
    return UserItemResponse(data=UserResponse.from_model(user))


@router.post(
    "",
    response_model=UserItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create user",
)
async def create_user(
    body: UserCreateRequest,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(
            require_any_permission(
                IdentityPermission.USERS_CREATE.value,
                IdentityPermission.USERS_MANAGE.value,
            )
        ),
    ],
    service: Annotated[UserService, Depends(get_user_service)],
) -> UserItemResponse:
    """Create a user (admin)."""
    user = await service.create_user(
        username=body.username,
        password=body.password,
        full_name=body.full_name,
        role_id=body.role_id,
        phone=body.phone,
        email=body.email,
        must_change_password=body.must_change_password,
        created_by=principal.user.id,
    )
    return UserItemResponse(data=UserResponse.from_model(user))


@router.patch(
    "/{user_id}",
    response_model=UserItemResponse,
    summary="Update user",
)
async def update_user(
    user_id: UUID,
    body: UserUpdateRequest,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(
            require_any_permission(
                IdentityPermission.USERS_UPDATE.value,
                IdentityPermission.USERS_MANAGE.value,
            )
        ),
    ],
    service: Annotated[UserService, Depends(get_user_service)],
) -> UserItemResponse:
    """Update mutable user fields (username cannot change)."""
    user = await service.update_user(
        user_id,
        full_name=body.full_name,
        phone=body.phone,
        email=body.email,
        role_id=body.role_id,
        updated_by=principal.user.id,
    )
    return UserItemResponse(data=UserResponse.from_model(user))


@router.post(
    "/{user_id}/deactivate",
    response_model=UserItemResponse,
    summary="Deactivate user",
)
async def deactivate_user(
    user_id: UUID,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(
            require_any_permission(
                IdentityPermission.USERS_UPDATE.value,
                IdentityPermission.USERS_MANAGE.value,
            )
        ),
    ],
    service: Annotated[UserService, Depends(get_user_service)],
) -> UserItemResponse:
    """Deactivate a user account."""
    user = await service.deactivate_user(user_id, updated_by=principal.user.id)
    return UserItemResponse(data=UserResponse.from_model(user))


@router.post(
    "/{user_id}/activate",
    response_model=UserItemResponse,
    summary="Activate user",
)
async def activate_user(
    user_id: UUID,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(
            require_any_permission(
                IdentityPermission.USERS_UPDATE.value,
                IdentityPermission.USERS_MANAGE.value,
            )
        ),
    ],
    service: Annotated[UserService, Depends(get_user_service)],
) -> UserItemResponse:
    """Activate a user account."""
    user = await service.activate_user(user_id, updated_by=principal.user.id)
    return UserItemResponse(data=UserResponse.from_model(user))


@router.delete(
    "/{user_id}",
    response_model=MessageOnlyResponse,
    summary="Soft-delete user",
)
async def delete_user(
    user_id: UUID,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(
            require_any_permission(
                IdentityPermission.USERS_DELETE.value,
                IdentityPermission.USERS_MANAGE.value,
            )
        ),
    ],
    service: Annotated[UserService, Depends(get_user_service)],
) -> MessageOnlyResponse:
    """Soft-delete a user."""
    await service.soft_delete_user(user_id, deleted_by=principal.user.id)
    return MessageOnlyResponse(message="تم حذف المستخدم")
