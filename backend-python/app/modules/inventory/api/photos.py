"""Dress photo HTTP endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, status

from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.inventory.constants import InventoryPermission
from app.modules.inventory.dependencies import get_dress_photo_service
from app.modules.inventory.schemas.dress_photo import (
    DressPhotoCoverRequest,
    DressPhotoCreateRequest,
    DressPhotoItemResponse,
    DressPhotoListResponse,
    DressPhotoReorderRequest,
    DressPhotoResponse,
    DressPhotoUpdateRequest,
    MessageOnlyResponse,
)
from app.modules.inventory.services.dress_photo import DressPhotoService
from app.modules.rbac.dependencies import require_permission

dresses_photos_router = APIRouter(prefix="/dresses", tags=["Dress Photos"])
dress_photos_router = APIRouter(prefix="/dress-photos", tags=["Dress Photos"])


def _client_ip(request: Request) -> str | None:
    if request.client is None:
        return None
    return request.client.host


@dresses_photos_router.get(
    "/{dress_id}/photos",
    response_model=DressPhotoListResponse,
    summary="List dress photos",
)
async def list_dress_photos(
    dress_id: UUID,
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(InventoryPermission.VIEW.value)),
    ],
    service: Annotated[DressPhotoService, Depends(get_dress_photo_service)],
) -> DressPhotoListResponse:
    """List live gallery photos for a dress."""
    items = await service.list_photos(dress_id)
    return DressPhotoListResponse(data=[DressPhotoResponse.from_model(item) for item in items])


@dresses_photos_router.post(
    "/{dress_id}/photos",
    response_model=DressPhotoItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Attach photo to dress",
)
async def add_dress_photo(
    dress_id: UUID,
    body: DressPhotoCreateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(InventoryPermission.UPDATE.value)),
    ],
    service: Annotated[DressPhotoService, Depends(get_dress_photo_service)],
) -> DressPhotoItemResponse:
    """Attach an already-uploaded Media file to a dress."""
    photo = await service.add_photo(
        dress_id,
        stored_file_id=body.stored_file_id,
        caption=body.caption,
        is_cover=body.is_cover,
        display_order=body.display_order,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return DressPhotoItemResponse(data=DressPhotoResponse.from_model(photo))


@dresses_photos_router.patch(
    "/{dress_id}/photos/reorder",
    response_model=DressPhotoListResponse,
    summary="Reorder dress photos",
)
async def reorder_dress_photos(
    dress_id: UUID,
    body: DressPhotoReorderRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(InventoryPermission.UPDATE.value)),
    ],
    service: Annotated[DressPhotoService, Depends(get_dress_photo_service)],
) -> DressPhotoListResponse:
    """Reorder gallery photos for a dress."""
    items = await service.reorder_photos(
        dress_id,
        photo_ids=body.photo_ids,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return DressPhotoListResponse(data=[DressPhotoResponse.from_model(item) for item in items])


@dresses_photos_router.patch(
    "/{dress_id}/photos/cover",
    response_model=DressPhotoItemResponse,
    summary="Set dress cover photo",
)
async def set_dress_cover(
    dress_id: UUID,
    body: DressPhotoCoverRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(InventoryPermission.UPDATE.value)),
    ],
    service: Annotated[DressPhotoService, Depends(get_dress_photo_service)],
) -> DressPhotoItemResponse:
    """Set the cover photo for a dress."""
    photo = await service.set_cover(
        dress_id,
        photo_id=body.photo_id,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return DressPhotoItemResponse(data=DressPhotoResponse.from_model(photo))


@dress_photos_router.patch(
    "/{photo_id}",
    response_model=DressPhotoItemResponse,
    summary="Update dress photo",
)
async def update_dress_photo(
    photo_id: UUID,
    body: DressPhotoUpdateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(InventoryPermission.UPDATE.value)),
    ],
    service: Annotated[DressPhotoService, Depends(get_dress_photo_service)],
) -> DressPhotoItemResponse:
    """Update caption, display order, or cover flag."""
    photo = await service.update_photo(
        photo_id,
        caption=body.caption,
        clear_caption=body.clear_caption,
        display_order=body.display_order,
        is_cover=body.is_cover,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return DressPhotoItemResponse(data=DressPhotoResponse.from_model(photo))


@dress_photos_router.delete(
    "/{photo_id}",
    response_model=MessageOnlyResponse,
    summary="Remove dress photo",
)
async def delete_dress_photo(
    photo_id: UUID,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(InventoryPermission.UPDATE.value)),
    ],
    service: Annotated[DressPhotoService, Depends(get_dress_photo_service)],
) -> MessageOnlyResponse:
    """Soft-delete a dress photo reference."""
    await service.remove_photo(
        photo_id,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return MessageOnlyResponse(message="تم حذف صورة الفستان")
