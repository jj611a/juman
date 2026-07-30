"""Dresses CRUD, barcode lookup, and activation endpoints."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status

from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.inventory.constants import DressSortField, InventoryPermission
from app.modules.inventory.dependencies import get_dress_service, get_dress_status_service
from app.modules.inventory.schemas.dress import (
    DressBarcodeUpdateRequest,
    DressCreateRequest,
    DressItemResponse,
    DressListResponse,
    DressResponse,
    DressSearchMeta,
    DressUpdateRequest,
    MessageOnlyResponse,
)
from app.modules.inventory.schemas.dress_status import (
    DressStatusChangeData,
    DressStatusChangeRequest,
    DressStatusChangeResponse,
)
from app.modules.inventory.services.dress import DressService
from app.modules.inventory.services.dress_status import DressStatusService
from app.modules.rbac.constants import SystemRoleName
from app.modules.rbac.dependencies import require_permission, require_system_role

router = APIRouter(prefix="/dresses", tags=["Dresses"])


def _client_ip(request: Request) -> str | None:
    if request.client is None:
        return None
    return request.client.host


@router.get(
    "",
    response_model=DressListResponse,
    summary="Search dresses",
)
async def list_dresses(
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(InventoryPermission.VIEW.value)),
    ],
    service: Annotated[DressService, Depends(get_dress_service)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
    q: Annotated[str | None, Query()] = None,
    barcode: Annotated[str | None, Query()] = None,
    category_id: Annotated[UUID | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    brand: Annotated[str | None, Query()] = None,
    size: Annotated[str | None, Query()] = None,
    colour: Annotated[str | None, Query()] = None,
    is_active: Annotated[bool | None, Query()] = None,
    purchase_price_min: Annotated[int | None, Query(ge=0)] = None,
    purchase_price_max: Annotated[int | None, Query(ge=0)] = None,
    rental_price_min: Annotated[int | None, Query(ge=0)] = None,
    rental_price_max: Annotated[int | None, Query(ge=0)] = None,
    sale_price_min: Annotated[int | None, Query(ge=0)] = None,
    sale_price_max: Annotated[int | None, Query(ge=0)] = None,
    created_from: Annotated[datetime | None, Query()] = None,
    created_to: Annotated[datetime | None, Query()] = None,
    updated_from: Annotated[datetime | None, Query()] = None,
    updated_to: Annotated[datetime | None, Query()] = None,
    sort_by: Annotated[DressSortField, Query()] = DressSortField.CREATED_AT,
    sort_dir: Annotated[str, Query(pattern="^(?i)(asc|desc)$")] = "desc",
) -> DressListResponse:
    """Search live dresses with filters, sort, and page-based pagination."""
    items, total = await service.list_dresses(
        q=q,
        barcode=barcode,
        category_id=category_id,
        status=status,
        brand=brand,
        size=size,
        colour=colour,
        is_active=is_active,
        purchase_price_min=purchase_price_min,
        purchase_price_max=purchase_price_max,
        rental_price_min=rental_price_min,
        rental_price_max=rental_price_max,
        sale_price_min=sale_price_min,
        sale_price_max=sale_price_max,
        created_from=created_from,
        created_to=created_to,
        updated_from=updated_from,
        updated_to=updated_to,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )
    return DressListResponse(
        data=[DressResponse.from_model(item) for item in items],
        meta=DressSearchMeta.from_total(page=page, page_size=page_size, total=total),
    )


@router.get(
    "/barcode/{barcode}",
    response_model=DressItemResponse,
    summary="Get dress by barcode",
)
async def get_dress_by_barcode(
    barcode: str,
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(InventoryPermission.VIEW.value)),
    ],
    service: Annotated[DressService, Depends(get_dress_service)],
) -> DressItemResponse:
    """Lookup a live dress by exact barcode."""
    dress = await service.get_dress_by_barcode(barcode)
    return DressItemResponse(data=DressResponse.from_model(dress))


@router.get(
    "/{dress_id}",
    response_model=DressItemResponse,
    summary="Get dress by id",
)
async def get_dress(
    dress_id: UUID,
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(InventoryPermission.VIEW.value)),
    ],
    service: Annotated[DressService, Depends(get_dress_service)],
) -> DressItemResponse:
    """Return a single dress."""
    dress = await service.get_dress(dress_id)
    return DressItemResponse(data=DressResponse.from_model(dress))


@router.post(
    "",
    response_model=DressItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create dress",
)
async def create_dress(
    body: DressCreateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(InventoryPermission.CREATE.value)),
    ],
    service: Annotated[DressService, Depends(get_dress_service)],
) -> DressItemResponse:
    """Create a dress asset (auto-generates barcode when omitted)."""
    dress = await service.create_dress(
        category_id=body.category_id,
        name_ar=body.name_ar,
        name_en=body.name_en,
        brand=body.brand,
        size=body.size,
        colour=body.colour,
        purchase_price=body.purchase_price,
        default_daily_rental_price=body.default_daily_rental_price,
        default_sale_price=body.default_sale_price,
        description=body.description,
        purchase_date=body.purchase_date,
        barcode=body.barcode,
        is_active=body.is_active,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return DressItemResponse(data=DressResponse.from_model(dress))


@router.post(
    "/{dress_id}/status",
    response_model=DressStatusChangeResponse,
    summary="Change dress status (Status Engine)",
)
async def change_dress_status(
    dress_id: UUID,
    body: DressStatusChangeRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(InventoryPermission.UPDATE.value)),
    ],
    status_service: Annotated[DressStatusService, Depends(get_dress_status_service)],
) -> DressStatusChangeResponse:
    """Apply an allowed status transition via DressStatusService."""
    result = await status_service.change_status(
        dress_id,
        body.new_status,
        reason=body.reason,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return DressStatusChangeResponse(
        data=DressStatusChangeData(
            dress_id=result.dress_id,
            previous_status=result.previous_status,
            new_status=result.new_status,
            allowed_transitions=result.allowed_transitions,
            reason=result.reason,
        )
    )


@router.patch(
    "/{dress_id}/barcode",
    response_model=DressItemResponse,
    summary="Change or regenerate dress barcode (Admin)",
)
async def update_dress_barcode(
    dress_id: UUID,
    body: DressBarcodeUpdateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_system_role(SystemRoleName.ADMIN.value)),
    ],
    service: Annotated[DressService, Depends(get_dress_service)],
) -> DressItemResponse:
    """Admin-only barcode change or regeneration."""
    dress = await service.set_barcode(
        dress_id,
        barcode=body.barcode,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return DressItemResponse(data=DressResponse.from_model(dress))


@router.patch(
    "/{dress_id}",
    response_model=DressItemResponse,
    summary="Update dress",
)
async def update_dress(
    dress_id: UUID,
    body: DressUpdateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(InventoryPermission.UPDATE.value)),
    ],
    service: Annotated[DressService, Depends(get_dress_service)],
) -> DressItemResponse:
    """Update dress fields (excluding barcode)."""
    dress = await service.update_dress(
        dress_id,
        category_id=body.category_id,
        name_ar=body.name_ar,
        name_en=body.name_en,
        brand=body.brand,
        size=body.size,
        colour=body.colour,
        purchase_price=body.purchase_price,
        default_daily_rental_price=body.default_daily_rental_price,
        default_sale_price=body.default_sale_price,
        description=body.description,
        purchase_date=body.purchase_date,
        clear_purchase_date=body.clear_purchase_date,
        is_active=body.is_active,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return DressItemResponse(data=DressResponse.from_model(dress))


@router.post(
    "/{dress_id}/activate",
    response_model=DressItemResponse,
    summary="Activate dress",
)
async def activate_dress(
    dress_id: UUID,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(InventoryPermission.UPDATE.value)),
    ],
    service: Annotated[DressService, Depends(get_dress_service)],
) -> DressItemResponse:
    """Activate a dress."""
    dress = await service.activate(
        dress_id,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return DressItemResponse(data=DressResponse.from_model(dress))


@router.post(
    "/{dress_id}/deactivate",
    response_model=DressItemResponse,
    summary="Deactivate dress",
)
async def deactivate_dress(
    dress_id: UUID,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(InventoryPermission.UPDATE.value)),
    ],
    service: Annotated[DressService, Depends(get_dress_service)],
) -> DressItemResponse:
    """Deactivate a dress."""
    dress = await service.deactivate(
        dress_id,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return DressItemResponse(data=DressResponse.from_model(dress))


@router.delete(
    "/{dress_id}",
    response_model=MessageOnlyResponse,
    summary="Soft-delete dress",
)
async def delete_dress(
    dress_id: UUID,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(InventoryPermission.DELETE.value)),
    ],
    service: Annotated[DressService, Depends(get_dress_service)],
) -> MessageOnlyResponse:
    """Soft-delete a dress."""
    await service.soft_delete(
        dress_id,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return MessageOnlyResponse(message="تم حذف الفستان")
