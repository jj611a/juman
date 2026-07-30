"""FastAPI application factory for the Juman backend foundation."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import Settings, get_settings, validate_settings
from app.core.constants import APP_DISPLAY_NAME, APP_NAME_AR
from app.core.lifespan import lifespan
from app.exceptions.handlers import register_exception_handlers
from app.middleware.request_id import RequestIdMiddleware
from app.middleware.timing import TimingMiddleware
from app.utils.logging import configure_logging, get_logger

logger = get_logger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """
    Build and configure the FastAPI application.

    Args:
        settings: Optional settings override (useful for tests).

    Raises:
        ConfigurationError: If production (or other env) configuration is invalid.
    """
    settings = settings or get_settings()
    validate_settings(settings)
    configure_logging(settings)

    app = FastAPI(
        title=f"{APP_DISPLAY_NAME} ({APP_NAME_AR})",
        description="Backend foundation for Juman POS & Rental Management System",
        version=settings.app_version,
        lifespan=lifespan,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        openapi_url="/openapi.json" if not settings.is_production else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(TimingMiddleware)
    app.add_middleware(RequestIdMiddleware)

    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/", include_in_schema=False)
    async def root() -> dict[str, str]:
        """Application root outside the versioned API prefix."""
        return {
            "name": APP_DISPLAY_NAME,
            "name_ar": APP_NAME_AR,
            "version": settings.app_version,
            "api": settings.api_v1_prefix,
        }

    logger.info(
        "application_created",
        extra={"event": "application_created", "environment": settings.app_env.value},
    )
    return app


app = create_app()
