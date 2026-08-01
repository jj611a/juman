"""Categories CRUD and activation endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status

from app.modules.categories.constants import CategoryPermission, CategorySortField
from app.modules.categories.dependencies import get_category_service
from app.modules.categories.schemas.category import (
    CategoryCreateRequest,
    CategoryItemResponse,
    CategoryListResponse,
    CategoryResponse,
    CategoryUpdateRequest,
    MessageOnlyResponse,
)
from app.modules.categories.services.category import CategoryService
from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.rbac.dependencies import require_permission
from app.schemas.common import PaginationMeta

router = APIRouter(prefix="/categories", tags=["Categories"])


def _client_ip(request: Request) -> str | None:
    if request.client is None:
        return None
    return request.client.host


@router.get(
    "",
    response_model=CategoryListResponse,
    summary="List categories",
)
async def list_categories(
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CategoryPermission.VIEW.value)),
    ],
    service: Annotated[CategoryService, Depends(get_category_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    active_only: Annotated[bool, Query()] = False,
    q: Annotated[str | None, Query()] = None,
    sort_by: Annotated[CategorySortField, Query()] = CategorySortField.DISPLAY_ORDER,
    sort_dir: Annotated[str, Query(pattern="^(?i)(asc|desc)$")] = "asc",
) -> CategoryListResponse:
    """List live categories (optionally only active) with search/sort/pagination."""
    _ = principal
    items, total = await service.list_categories(
        active_only=active_only,
        q=q,
        sort_by=sort_by,
        sort_dir=sort_dir,
        offset=offset,
        limit=limit,
    )
    return CategoryListResponse(
        data=[CategoryResponse.from_model(item) for item in items],
        meta=PaginationMeta(offset=offset, limit=limit, total=total),
    )


@router.get(
    "/{category_id}",
    response_model=CategoryItemResponse,
    summary="Get category by id",
)
async def get_category(
    category_id: UUID,
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CategoryPermission.VIEW.value)),
    ],
    service: Annotated[CategoryService, Depends(get_category_service)],
) -> CategoryItemResponse:
    """Return a single category."""
    category = await service.get_category(category_id)
    return CategoryItemResponse(data=CategoryResponse.from_model(category))


@router.post(
    "",
    response_model=CategoryItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create category",
)
async def create_category(
    body: CategoryCreateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CategoryPermission.CREATE.value)),
    ],
    service: Annotated[CategoryService, Depends(get_category_service)],
) -> CategoryItemResponse:
    """Create a category."""
    category = await service.create_category(
        name_ar=body.name_ar,
        name_en=body.name_en,
        description=body.description,
        display_order=body.display_order,
        is_active=body.is_active,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return CategoryItemResponse(data=CategoryResponse.from_model(category))


@router.patch(
    "/{category_id}",
    response_model=CategoryItemResponse,
    summary="Update category",
)
async def update_category(
    category_id: UUID,
    body: CategoryUpdateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CategoryPermission.UPDATE.value)),
    ],
    service: Annotated[CategoryService, Depends(get_category_service)],
) -> CategoryItemResponse:
    """Update category fields."""
    category = await service.update_category(
        category_id,
        name_ar=body.name_ar,
        name_en=body.name_en,
        description=body.description,
        display_order=body.display_order,
        is_active=body.is_active,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return CategoryItemResponse(data=CategoryResponse.from_model(category))


@router.post(
    "/{category_id}/activate",
    response_model=CategoryItemResponse,
    summary="Activate category",
)
async def activate_category(
    category_id: UUID,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CategoryPermission.UPDATE.value)),
    ],
    service: Annotated[CategoryService, Depends(get_category_service)],
) -> CategoryItemResponse:
    """Activate a category."""
    category = await service.activate(
        category_id,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return CategoryItemResponse(data=CategoryResponse.from_model(category))


@router.post(
    "/{category_id}/deactivate",
    response_model=CategoryItemResponse,
    summary="Deactivate category",
)
async def deactivate_category(
    category_id: UUID,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CategoryPermission.UPDATE.value)),
    ],
    service: Annotated[CategoryService, Depends(get_category_service)],
) -> CategoryItemResponse:
    """Deactivate a category."""
    category = await service.deactivate(
        category_id,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return CategoryItemResponse(data=CategoryResponse.from_model(category))


@router.delete(
    "/{category_id}",
    response_model=MessageOnlyResponse,
    summary="Soft-delete category",
)
async def delete_category(
    category_id: UUID,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CategoryPermission.DELETE.value)),
    ],
    service: Annotated[CategoryService, Depends(get_category_service)],
) -> MessageOnlyResponse:
    """Soft-delete a category when not referenced by dresses."""
    await service.soft_delete(
        category_id,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return MessageOnlyResponse(message="تم حذف التصنيف")
