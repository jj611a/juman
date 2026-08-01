"""Sale request/response schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from app.modules.sales.constants import SaleOrigin, SalePaymentMethod
from app.modules.sales.models.item import SaleItem
from app.modules.sales.models.payment import SalePayment
from app.modules.sales.models.sale import Sale
from app.schemas.common import APIModel, PaginationMeta
from app.utils.datetime import ensure_utc


class SaleItemCreateRequest(APIModel):
    dress_id: UUID
    actual_sale_price: int | None = Field(default=None, ge=1)
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("notes", mode="before")
    @classmethod
    def _strip_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class SalePaymentCreateRequest(APIModel):
    amount: int = Field(gt=0)
    payment_method: SalePaymentMethod
    reference_number: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=1000)
    received_at: datetime | None = None

    @field_validator("reference_number", "notes", mode="before")
    @classmethod
    def _strip_optional(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class SaleCreateRequest(APIModel):
    origin: SaleOrigin
    customer_id: UUID | None = None
    inspection_item_id: UUID | None = None
    items: list[SaleItemCreateRequest] = Field(min_length=1)
    payment: SalePaymentCreateRequest
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("notes", mode="before")
    @classmethod
    def _strip_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @model_validator(mode="after")
    def _mandatory_fields(self) -> SaleCreateRequest:
        if self.origin == SaleOrigin.MANDATORY_DAMAGE_PURCHASE:
            if self.inspection_item_id is None:
                raise ValueError("inspection_item_id required for mandatory sale")
            if self.customer_id is None:
                raise ValueError("customer_id required for mandatory sale")
            if len(self.items) != 1:
                raise ValueError("mandatory sale accepts exactly one item")
        return self


class SaleItemResponse(APIModel):
    id: UUID
    sale_id: UUID
    dress_id: UUID
    default_sale_price: int
    actual_sale_price: int
    inspection_item_id: UUID | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, item: SaleItem) -> SaleItemResponse:
        return cls(
            id=item.id,
            sale_id=item.sale_id,
            dress_id=item.dress_id,
            default_sale_price=item.default_sale_price,
            actual_sale_price=item.actual_sale_price,
            inspection_item_id=item.inspection_item_id,
            notes=item.notes,
            created_at=ensure_utc(item.created_at),
            updated_at=ensure_utc(item.updated_at),
        )


class SalePaymentResponse(APIModel):
    id: UUID
    sale_id: UUID
    amount: int
    payment_method: str
    received_at: datetime
    received_by: UUID | None = None
    reference_number: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, payment: SalePayment) -> SalePaymentResponse:
        return cls(
            id=payment.id,
            sale_id=payment.sale_id,
            amount=payment.amount,
            payment_method=payment.payment_method,
            received_at=ensure_utc(payment.received_at),
            received_by=payment.received_by,
            reference_number=payment.reference_number,
            notes=payment.notes,
            created_at=ensure_utc(payment.created_at),
            updated_at=ensure_utc(payment.updated_at),
        )


class SaleResponse(APIModel):
    id: UUID
    sale_number: str
    origin: str
    status: str
    customer_id: UUID | None = None
    rental_id: UUID | None = None
    return_id: UUID | None = None
    inspection_id: UUID | None = None
    total_amount: int
    sold_at: datetime
    sold_by: UUID | None = None
    notes: str | None = None
    items: list[SaleItemResponse]
    payments: list[SalePaymentResponse]
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, record: Sale) -> SaleResponse:
        items = sorted(record.items or [], key=lambda row: row.created_at)
        payments = sorted(record.payments or [], key=lambda row: row.created_at)
        return cls(
            id=record.id,
            sale_number=record.sale_number,
            origin=record.origin,
            status=record.status,
            customer_id=record.customer_id,
            rental_id=record.rental_id,
            return_id=record.return_id,
            inspection_id=record.inspection_id,
            total_amount=record.total_amount,
            sold_at=ensure_utc(record.sold_at),
            sold_by=record.sold_by,
            notes=record.notes,
            items=[SaleItemResponse.from_model(row) for row in items],
            payments=[SalePaymentResponse.from_model(row) for row in payments],
            created_at=ensure_utc(record.created_at),
            updated_at=ensure_utc(record.updated_at),
        )


class SaleListResponse(APIModel):
    success: bool = True
    data: list[SaleResponse]
    meta: PaginationMeta


class SaleItemEnvelope(APIModel):
    success: bool = True
    data: SaleResponse

