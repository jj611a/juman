"""Unified error response schemas."""

from typing import Any

from app.schemas.common import APIModel


class ErrorBody(APIModel):
    """Structured error payload."""

    code: str
    message: str
    details: Any | None = None
    request_id: str | None = None


class ErrorResponse(APIModel):
    """Top-level error envelope returned by global handlers."""

    success: bool = False
    error: ErrorBody
