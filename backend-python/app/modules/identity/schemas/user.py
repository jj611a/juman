"""User request/response schemas — Phase 1."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.modules.identity.models.user import User
from app.modules.identity.validators import (
    normalize_username,
    validate_optional_email,
    validate_optional_phone,
)
from app.schemas.common import APIModel, PaginationMeta


class UserCreateRequest(APIModel):
    """Admin create-user payload."""

    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)
    role_id: UUID
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    must_change_password: bool = True

    @field_validator("username")
    @classmethod
    def _normalize_username(cls, value: str) -> str:
        return normalize_username(value)

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str | None) -> str | None:
        return validate_optional_phone(value)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str | None) -> str | None:
        return validate_optional_email(value)


class UserUpdateRequest(APIModel):
    """Admin update-user payload (username immutable)."""

    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    role_id: UUID | None = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str | None) -> str | None:
        return validate_optional_phone(value)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str | None) -> str | None:
        return validate_optional_email(value)


class UserResponse(APIModel):
    """Public user representation (no password hash)."""

    id: UUID
    username: str
    full_name: str
    phone: str | None
    email: str | None
    role_id: UUID
    is_active: bool
    is_locked: bool
    must_change_password: bool
    failed_login_attempts: int
    last_login_at: datetime | None
    password_changed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, user: User) -> UserResponse:
        return cls(
            id=user.id,
            username=user.username,
            full_name=user.full_name,
            phone=user.phone,
            email=user.email,
            role_id=user.role_id,
            is_active=user.is_active,
            is_locked=user.is_locked,
            must_change_password=user.must_change_password,
            failed_login_attempts=user.failed_login_attempts,
            last_login_at=user.last_login_at,
            password_changed_at=user.password_changed_at,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )


class UserItemResponse(APIModel):
    """Single user envelope."""

    success: bool = True
    data: UserResponse


class UserListResponse(APIModel):
    """Paginated user list envelope."""

    success: bool = True
    data: list[UserResponse]
    meta: PaginationMeta


class MessageOnlyResponse(APIModel):
    """Simple success message."""

    success: bool = True
    message: str
