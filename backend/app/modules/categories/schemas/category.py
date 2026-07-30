"""Category request/response schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.modules.categories.models.category import Category
from app.schemas.common import APIModel, PaginationMeta


def _normalize_optional_str(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


class CategoryCreateRequest(APIModel):
    """Create category payload."""

    name_ar: str = Field(min_length=1, max_length=200)
    name_en: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    display_order: int = Field(default=0)
    is_active: bool = True

    @field_validator("name_ar", mode="before")
    @classmethod
    def _strip_name_ar(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("name_en", "description")
    @classmethod
    def _optional_text(cls, value: str | None) -> str | None:
        return _normalize_optional_str(value)


class CategoryUpdateRequest(APIModel):
    """Partial update payload."""

    name_ar: str | None = Field(default=None, min_length=1, max_length=200)
    name_en: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    display_order: int | None = None
    is_active: bool | None = None

    @field_validator("name_ar", mode="before")
    @classmethod
    def _strip_name_ar(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("name_en", "description")
    @classmethod
    def _optional_text(cls, value: str | None) -> str | None:
        return _normalize_optional_str(value)


class CategoryResponse(APIModel):
    """Category API representation."""

    id: UUID
    name_ar: str
    name_en: str | None = None
    description: str | None = None
    display_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, category: Category) -> CategoryResponse:
        return cls(
            id=category.id,
            name_ar=category.name_ar,
            name_en=category.name_en,
            description=category.description,
            display_order=category.display_order,
            is_active=category.is_active,
            created_at=category.created_at,
            updated_at=category.updated_at,
        )


class CategoryListResponse(APIModel):
    """Paginated category list."""

    success: bool = True
    data: list[CategoryResponse]
    meta: PaginationMeta


class CategoryItemResponse(APIModel):
    """Single category envelope."""

    success: bool = True
    data: CategoryResponse


class MessageOnlyResponse(APIModel):
    """Simple success message."""

    success: bool = True
    message: str
