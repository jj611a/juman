"""Request and response schemas for the Settings module."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import Field

from app.modules.settings.enums import SettingCategory, SettingValueType
from app.modules.settings.validation import deserialize_setting_value
from app.schemas.common import APIModel


class SettingResponse(APIModel):
    """Public representation of a setting, including a typed ``parsed_value``."""

    id: UUID
    key: str
    value: str
    parsed_value: Any
    value_type: SettingValueType
    category: SettingCategory
    description: str | None = None
    is_editable: bool
    created_at: datetime
    updated_at: datetime
    created_by: UUID | None = None
    updated_by: UUID | None = None

    @classmethod
    def from_model(cls, setting: Any) -> "SettingResponse":
        """Map a SQLAlchemy ``Setting`` entity to an API response."""
        return cls(
            id=setting.id,
            key=setting.key,
            value=setting.value,
            parsed_value=deserialize_setting_value(setting.value, setting.value_type),
            value_type=SettingValueType(setting.value_type),
            category=SettingCategory(setting.category),
            description=setting.description,
            is_editable=setting.is_editable,
            created_at=setting.created_at,
            updated_at=setting.updated_at,
            created_by=setting.created_by,
            updated_by=setting.updated_by,
        )


class SettingListResponse(APIModel):
    """Envelope for listing settings."""

    success: bool = True
    total: int
    items: list[SettingResponse]


class SettingUpdateRequest(APIModel):
    """PUT body for updating a setting."""

    value: Any = Field(..., description="New setting value (typed according to value_type)")
    description: str | None = Field(
        default=None,
        description="Optional updated Arabic/English description",
    )


class SettingValueUpdateRequest(APIModel):
    """PATCH body for updating only the setting value."""

    value: Any = Field(..., description="New setting value")
