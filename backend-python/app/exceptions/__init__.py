"""Unified exception taxonomy for the Juman backend."""

from app.exceptions.base import AppException
from app.exceptions.http import (
    AuthenticationError,
    AuthorizationError,
    BusinessError,
    ConflictError,
    DatabaseError,
    NotFoundError,
    ValidationError,
)

__all__ = [
    "AppException",
    "AuthenticationError",
    "AuthorizationError",
    "BusinessError",
    "ConflictError",
    "DatabaseError",
    "NotFoundError",
    "ValidationError",
]
