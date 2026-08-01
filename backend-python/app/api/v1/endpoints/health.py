"""Health check endpoint."""

from typing import Literal

from fastapi import APIRouter, Request
from redis.asyncio import Redis
from sqlalchemy import text

from app.config import get_settings
from app.core.constants import APP_DISPLAY_NAME
from app.database.engine import get_engine
from app.database.redis import ping_redis
from app.schemas.health import HealthResponse
from app.utils.logging import get_logger

router = APIRouter()
logger = get_logger(__name__)


@router.get("/health", response_model=HealthResponse, summary="Health check")
async def health_check(request: Request) -> HealthResponse:
    """
    Probe application, database, and optional Redis health.

    Database connectivity is required for ``status=ok``. Redis is optional.
    """
    settings = get_settings()
    database_status: Literal["up", "down"] = "down"
    try:
        engine = get_engine()
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        database_status = "up"
    except Exception:
        logger.exception("health_database_ping_failed")
        database_status = "down"

    redis_client: Redis | None = getattr(request.app.state, "redis", None)
    redis_status = await ping_redis(redis_client)

    if database_status == "down":
        overall: Literal["ok", "degraded", "down"] = "down"
    elif redis_status == "down":
        overall = "degraded"
    else:
        overall = "ok"

    return HealthResponse(
        status=overall,
        app=APP_DISPLAY_NAME,
        environment=settings.app_env.value,
        database=database_status,
        redis=redis_status,  # type: ignore[arg-type]
        version=settings.app_version,
    )
