"""Password change / admin reset request schemas."""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from app.schemas.common import APIModel


class ChangePasswordRequest(APIModel):
    """Self-service password change payload."""

    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class AdminResetPasswordRequest(APIModel):
    """Admin reset-password payload."""

    user_id: UUID
    new_password: str = Field(min_length=8, max_length=128)
