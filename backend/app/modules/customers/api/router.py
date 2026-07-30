"""Customers CRUD and activation endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status

from app.modules.customers.constants import CustomerPermission, CustomerSortField
from app.modules.customers.dependencies import get_customer_service
from app.modules.customers.schemas.customer import (
    CustomerCreateRequest,
    CustomerItemResponse,
    CustomerListResponse,
    CustomerResponse,
    CustomerUpdateRequest,
    MessageOnlyResponse,
)
from app.modules.customers.services.customer import CustomerService
from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.rbac.dependencies import require_permission
from app.schemas.common import PaginationMeta

router = APIRouter(prefix="/customers", tags=["Customers"])


def _client_ip(request: Request) -> str | None:
    if request.client is None:
        return None
    return request.client.host


@router.get(
    "",
    response_model=CustomerListResponse,
    summary="List customers",
)
async def list_customers(
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CustomerPermission.VIEW.value)),
    ],
    service: Annotated[CustomerService, Depends(get_customer_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    active_only: Annotated[bool, Query()] = False,
    q: Annotated[str | None, Query()] = None,
    sort_by: Annotated[CustomerSortField, Query()] = CustomerSortField.FULL_NAME,
    sort_dir: Annotated[str, Query(pattern="^(?i)(asc|desc)$")] = "asc",
) -> CustomerListResponse:
    """List live customers with search, sort, and active filter."""
    items, total = await service.list_customers(
        active_only=active_only,
        q=q,
        sort_by=sort_by,
        sort_dir=sort_dir,
        offset=offset,
        limit=limit,
    )
    return CustomerListResponse(
        data=[CustomerResponse.from_model(item) for item in items],
        meta=PaginationMeta(offset=offset, limit=limit, total=total),
    )


@router.get(
    "/number/{customer_number}",
    response_model=CustomerItemResponse,
    summary="Get customer by customer number",
)
async def get_customer_by_number(
    customer_number: str,
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CustomerPermission.VIEW.value)),
    ],
    service: Annotated[CustomerService, Depends(get_customer_service)],
) -> CustomerItemResponse:
    """Lookup a live customer by exact customer number."""
    customer = await service.get_customer_by_number(customer_number)
    return CustomerItemResponse(data=CustomerResponse.from_model(customer))


@router.get(
    "/{customer_id}",
    response_model=CustomerItemResponse,
    summary="Get customer by id",
)
async def get_customer(
    customer_id: UUID,
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CustomerPermission.VIEW.value)),
    ],
    service: Annotated[CustomerService, Depends(get_customer_service)],
) -> CustomerItemResponse:
    """Return a single customer."""
    customer = await service.get_customer(customer_id)
    return CustomerItemResponse(data=CustomerResponse.from_model(customer))


@router.post(
    "",
    response_model=CustomerItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create customer",
)
async def create_customer(
    body: CustomerCreateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CustomerPermission.CREATE.value)),
    ],
    service: Annotated[CustomerService, Depends(get_customer_service)],
) -> CustomerItemResponse:
    """Create a customer (auto-generates customer_number)."""
    customer = await service.create_customer(
        full_name=body.full_name,
        phone=body.phone,
        alternative_phone=body.alternative_phone,
        address=body.address,
        national_id=body.national_id,
        notes=body.notes,
        gender=body.gender,
        birth_date=body.birth_date,
        is_active=body.is_active,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return CustomerItemResponse(data=CustomerResponse.from_model(customer))


@router.patch(
    "/{customer_id}",
    response_model=CustomerItemResponse,
    summary="Update customer",
)
async def update_customer(
    customer_id: UUID,
    body: CustomerUpdateRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CustomerPermission.UPDATE.value)),
    ],
    service: Annotated[CustomerService, Depends(get_customer_service)],
) -> CustomerItemResponse:
    """Update customer fields (customer_number is immutable)."""
    customer = await service.update_customer(
        customer_id,
        full_name=body.full_name,
        phone=body.phone,
        alternative_phone=body.alternative_phone,
        address=body.address,
        national_id=body.national_id,
        notes=body.notes,
        gender=body.gender,
        birth_date=body.birth_date,
        clear_birth_date=body.clear_birth_date,
        is_active=body.is_active,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return CustomerItemResponse(data=CustomerResponse.from_model(customer))


@router.post(
    "/{customer_id}/activate",
    response_model=CustomerItemResponse,
    summary="Activate customer",
)
async def activate_customer(
    customer_id: UUID,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CustomerPermission.UPDATE.value)),
    ],
    service: Annotated[CustomerService, Depends(get_customer_service)],
) -> CustomerItemResponse:
    """Activate a customer."""
    customer = await service.activate(
        customer_id,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return CustomerItemResponse(data=CustomerResponse.from_model(customer))


@router.post(
    "/{customer_id}/deactivate",
    response_model=CustomerItemResponse,
    summary="Deactivate customer",
)
async def deactivate_customer(
    customer_id: UUID,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CustomerPermission.UPDATE.value)),
    ],
    service: Annotated[CustomerService, Depends(get_customer_service)],
) -> CustomerItemResponse:
    """Deactivate a customer."""
    customer = await service.deactivate(
        customer_id,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return CustomerItemResponse(data=CustomerResponse.from_model(customer))


@router.delete(
    "/{customer_id}",
    response_model=MessageOnlyResponse,
    summary="Soft-delete customer",
)
async def delete_customer(
    customer_id: UUID,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(CustomerPermission.DELETE.value)),
    ],
    service: Annotated[CustomerService, Depends(get_customer_service)],
) -> MessageOnlyResponse:
    """Soft-delete a customer."""
    await service.soft_delete(
        customer_id,
        actor_id=principal.user.id,
        actor_username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return MessageOnlyResponse(message="تم حذف العميل")
