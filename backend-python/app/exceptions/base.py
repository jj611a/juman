"""Base application exception type."""

from typing import Any


class AppException(Exception):
    """
    Base exception for all controlled application failures.

    Attributes:
        code: Stable English machine-readable error code.
        message: Human-readable message (Arabic-ready for UI consumption).
        status_code: HTTP status code to return.
        details: Optional structured details for clients/logs.
    """

    def __init__(
        self,
        message: str,
        *,
        code: str = "app_error",
        status_code: int = 400,
        details: dict[str, Any] | list[Any] | None = None,
    ) -> None:
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details
        super().__init__(message)
