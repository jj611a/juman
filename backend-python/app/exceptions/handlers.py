"""Global FastAPI exception handlers producing a unified error envelope."""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.exceptions.base import AppException
from app.middleware.request_id import get_request_id
from app.utils.logging import get_logger

logger = get_logger(__name__)


def _error_body(
    *,
    code: str,
    message: str,
    details: Any = None,
) -> dict[str, Any]:
    return {
        "success": False,
        "error": {
            "code": code,
            "message": message,
            "details": details,
            "request_id": get_request_id(),
        },
    }


async def app_exception_handler(_: Request, exc: AppException) -> JSONResponse:
    """Handle controlled application exceptions."""
    logger.warning(
        "app_exception",
        extra={"event": "app_exception", "code": exc.code, "status_code": exc.status_code},
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(code=exc.code, message=exc.message, details=exc.details),
    )


async def validation_exception_handler(
    _: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Handle Pydantic / FastAPI request validation errors."""
    return JSONResponse(
        status_code=422,
        content=_error_body(
            code="validation_error",
            message="بيانات غير صالحة",
            details=exc.errors(),
        ),
    )


async def integrity_error_handler(_: Request, exc: IntegrityError) -> JSONResponse:
    """Map database integrity violations to HTTP 409."""
    logger.warning("integrity_error", extra={"event": "integrity_error"})
    return JSONResponse(
        status_code=409,
        content=_error_body(
            code="conflict",
            message="تعارض في البيانات",
            details={"constraint": str(exc.orig) if exc.orig else None},
        ),
    )


async def sqlalchemy_error_handler(_: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Map unexpected SQLAlchemy errors to HTTP 500."""
    logger.exception("database_error", extra={"event": "database_error"})
    return JSONResponse(
        status_code=500,
        content=_error_body(
            code="database_error",
            message="حدث خطأ في قاعدة البيانات",
            details=None,
        ),
    )


async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    """Catch-all handler for unexpected failures."""
    logger.exception("unhandled_exception", extra={"event": "unhandled_exception"})
    return JSONResponse(
        status_code=500,
        content=_error_body(
            code="internal_error",
            message="حدث خطأ غير متوقع",
            details=None,
        ),
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Attach all global exception handlers to the FastAPI application."""
    app.add_exception_handler(AppException, app_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(IntegrityError, integrity_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(SQLAlchemyError, sqlalchemy_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unhandled_exception_handler)
