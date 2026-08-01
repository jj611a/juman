"""Dress request/response schemas."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.modules.inventory.models.dress import Dress
from app.schemas.common import APIModel


class DressCreateRequest(APIModel):
    """Create dress payload."""

    category_id: UUID
    name_ar: str = Field(min_length=1, max_length=200)
    name_en: str | None = Field(default=None, max_length=200)
    brand: str | None = Field(default=None, max_length=200)
    size: str = Field(min_length=1, max_length=20)
    colour: str = Field(min_length=1, max_length=50)
    purchase_price: int = Field(ge=0)
    default_daily_rental_price: int = Field(ge=0)
    default_sale_price: int = Field(ge=0)
    description: str | None = Field(default=None, max_length=10000)
    purchase_date: date | None = None
    barcode: str | None = Field(default=None, max_length=64)
    is_active: bool = True

    @field_validator("name_ar", "size", "colour", mode="before")
    @classmethod
    def _strip_required(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("name_en", "brand", "description", "barcode", mode="before")
    @classmethod
    def _strip_optional(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class DressUpdateRequest(APIModel):
    """Partial update payload (barcode changes use PATCH /dresses/{id}/barcode).

    Status changes must use POST /dresses/{id}/status (DressStatusService).
    """

    category_id: UUID | None = None
    name_ar: str | None = Field(default=None, min_length=1, max_length=200)
    name_en: str | None = Field(default=None, max_length=200)
    brand: str | None = Field(default=None, max_length=200)
    size: str | None = Field(default=None, min_length=1, max_length=20)
    colour: str | None = Field(default=None, min_length=1, max_length=50)
    purchase_price: int | None = Field(default=None, ge=0)
    default_daily_rental_price: int | None = Field(default=None, ge=0)
    default_sale_price: int | None = Field(default=None, ge=0)
    description: str | None = Field(default=None, max_length=10000)
    purchase_date: date | None = None
    clear_purchase_date: bool = False
    is_active: bool | None = None

    @field_validator("name_ar", "size", "colour", mode="before")
    @classmethod
    def _strip_required(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("name_en", "brand", "description", mode="before")
    @classmethod
    def _strip_optional(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class DressBarcodeUpdateRequest(APIModel):
    """Admin barcode change / regenerate payload."""

    barcode: str | None = Field(default=None, max_length=64)

    @field_validator("barcode", mode="before")
    @classmethod
    def _strip_optional(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class DressResponse(APIModel):
    """Dress API representation."""

    id: UUID
    barcode: str
    category_id: UUID
    name_ar: str
    name_en: str | None = None
    brand: str | None = None
    size: str
    colour: str
    purchase_price: int
    default_daily_rental_price: int
    default_sale_price: int
    description: str | None = None
    purchase_date: date | None = None
    status: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, dress: Dress) -> DressResponse:
        return cls(
            id=dress.id,
            barcode=dress.barcode,
            category_id=dress.category_id,
            name_ar=dress.name_ar,
            name_en=dress.name_en,
            brand=dress.brand,
            size=dress.size,
            colour=dress.colour,
            purchase_price=dress.purchase_price,
            default_daily_rental_price=dress.default_daily_rental_price,
            default_sale_price=dress.default_sale_price,
            description=dress.description,
            purchase_date=dress.purchase_date,
            status=dress.status,
            is_active=dress.is_active,
            created_at=dress.created_at,
            updated_at=dress.updated_at,
        )


class DressSearchMeta(APIModel):
    """Page-based pagination metadata for dress search."""

    page: int
    page_size: int
    total: int
    pages: int

    @classmethod
    def from_total(cls, *, page: int, page_size: int, total: int) -> DressSearchMeta:
        pages = 0 if total == 0 else (total + page_size - 1) // page_size
        return cls(page=page, page_size=page_size, total=total, pages=pages)


class DressListResponse(APIModel):
    """Paginated dress search result (Phase 5 page meta)."""

    success: bool = True
    data: list[DressResponse]
    meta: DressSearchMeta


class DressItemResponse(APIModel):
    """Single dress envelope."""

    success: bool = True
    data: DressResponse


class MessageOnlyResponse(APIModel):
    """Simple success message."""

    success: bool = True
    message: str
