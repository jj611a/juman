"""Permission request/response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.common import APIModel


class PermissionResponse(APIModel):
    """Public permission representation."""

    id: UUID
    key: str
    display_name: str
    description: str | None = None
    module: str
    created_at: datetime
    updated_at: datetime
    created_by: UUID | None = None
    updated_by: UUID | None = None


class PermissionListResponse(APIModel):
    """Envelope for listing permissions."""

    success: bool = True
    total: int
    items: list[PermissionResponse]


class PermissionCreateRequest(APIModel):
    """Create a permission definition."""

    key: str = Field(..., min_length=3, max_length=100, examples=["inventory.view"])
    display_name: str = Field(..., min_length=1, max_length=150)
    description: str | None = None
    module: str | None = Field(default=None, max_length=50)


class PermissionUpdateRequest(APIModel):
    """Update mutable permission fields."""

    display_name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    module: str | None = Field(default=None, max_length=50)
