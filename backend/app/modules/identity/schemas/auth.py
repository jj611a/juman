"""Auth request/response schemas — Identity Phase 7."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.modules.identity.schemas.user import UserResponse
from app.modules.identity.validators import (
    normalize_username,
    validate_optional_email,
    validate_optional_phone,
)
from app.schemas.common import APIModel


class LoginRequest(APIModel):
    """Username/password login payload."""

    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=1, max_length=128)
    remember_me: bool = False
    device_name: str | None = Field(default=None, max_length=150)

    @field_validator("username")
    @classmethod
    def _normalize_username(cls, value: str) -> str:
        return normalize_username(value)


class RefreshRequest(APIModel):
    """Opaque refresh token payload."""

    refresh_token: str = Field(min_length=1, max_length=512)


class TokenData(APIModel):
    """Issued token pair plus session metadata."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    access_expires_at: datetime | None = None
    refresh_expires_at: datetime | None = None
    session_id: UUID
    user: UserResponse


class LoginResponse(APIModel):
    """Login success envelope."""

    success: bool = True
    data: TokenData


class RefreshResponse(APIModel):
    """Refresh success envelope."""

    success: bool = True
    data: TokenData


class MeUpdateRequest(APIModel):
    """Self-service profile update (no role/username/password)."""

    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str | None) -> str | None:
        return validate_optional_phone(value)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str | None) -> str | None:
        return validate_optional_email(value)
