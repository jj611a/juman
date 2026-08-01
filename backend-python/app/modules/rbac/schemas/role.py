"""Role request/response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.modules.rbac.schemas.permission import PermissionResponse
from app.schemas.common import APIModel


class RoleResponse(APIModel):
    """Public role representation."""

    id: UUID
    name: str
    description: str | None = None
    is_system: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: UUID | None = None
    updated_by: UUID | None = None
    permissions: list[PermissionResponse] = Field(default_factory=list)


class RoleListResponse(APIModel):
    """Envelope for listing roles."""

    success: bool = True
    total: int
    items: list[RoleResponse]


class RoleCreateRequest(APIModel):
    """Create a custom role."""

    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    is_active: bool = True
    permission_keys: list[str] = Field(default_factory=list)


class RoleUpdateRequest(APIModel):
    """Update role fields."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    is_active: bool | None = None


class RolePermissionAssignRequest(APIModel):
    """Assign permissions to a role by key."""

    permission_keys: list[str] = Field(..., min_length=1)
