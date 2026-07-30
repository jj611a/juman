"""Specialized HTTP-oriented application exceptions."""

from typing import Any

from app.exceptions.base import AppException


class ValidationError(AppException):
    """Raised when input fails domain or application validation."""

    def __init__(
        self,
        message: str = "بيانات غير صالحة",
        *,
        details: dict[str, Any] | list[Any] | None = None,
    ) -> None:
        super().__init__(
            message,
            code="validation_error",
            status_code=422,
            details=details,
        )


class AuthenticationError(AppException):
    """Raised when authentication fails or credentials are missing."""

    def __init__(
        self,
        message: str = "المصادقة مطلوبة",
        *,
        code: str = "authentication_error",
        details: dict[str, Any] | list[Any] | None = None,
    ) -> None:
        super().__init__(
            message,
            code=code,
            status_code=401,
            details=details,
        )


class AuthorizationError(AppException):
    """Raised when the caller lacks required permissions."""

    def __init__(
        self,
        message: str = "ليس لديك صلاحية لتنفيذ هذا الإجراء",
        *,
        code: str = "authorization_error",
        details: dict[str, Any] | list[Any] | None = None,
    ) -> None:
        super().__init__(
            message,
            code=code,
            status_code=403,
            details=details,
        )


class BusinessError(AppException):
    """Raised for domain rule violations that are not validation failures."""

    def __init__(
        self,
        message: str,
        *,
        code: str = "business_error",
        status_code: int = 400,
        details: dict[str, Any] | list[Any] | None = None,
    ) -> None:
        super().__init__(
            message,
            code=code,
            status_code=status_code,
            details=details,
        )


class DatabaseError(AppException):
    """Raised when persistence operations fail unexpectedly."""

    def __init__(
        self,
        message: str = "حدث خطأ في قاعدة البيانات",
        *,
        details: dict[str, Any] | list[Any] | None = None,
    ) -> None:
        super().__init__(
            message,
            code="database_error",
            status_code=500,
            details=details,
        )


class NotFoundError(AppException):
    """Raised when a requested resource does not exist."""

    def __init__(
        self,
        message: str = "العنصر غير موجود",
        *,
        details: dict[str, Any] | list[Any] | None = None,
    ) -> None:
        super().__init__(
            message,
            code="not_found",
            status_code=404,
            details=details,
        )


class ConflictError(AppException):
    """Raised when a unique constraint or state conflict occurs."""

    def __init__(
        self,
        message: str = "تعارض في البيانات",
        *,
        details: dict[str, Any] | list[Any] | None = None,
    ) -> None:
        super().__init__(
            message,
            code="conflict",
            status_code=409,
            details=details,
        )
