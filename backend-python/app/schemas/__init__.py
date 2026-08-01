"""Shared Pydantic schemas for foundation API responses."""

from app.schemas.common import APIModel, MessageResponse, PaginationMeta, PaginationParams
from app.schemas.error import ErrorBody, ErrorResponse
from app.schemas.health import HealthResponse, VersionResponse

__all__ = [
    "APIModel",
    "ErrorBody",
    "ErrorResponse",
    "HealthResponse",
    "MessageResponse",
    "PaginationMeta",
    "PaginationParams",
    "VersionResponse",
]
