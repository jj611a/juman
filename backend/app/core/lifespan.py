"""Application lifespan management for startup and shutdown hooks."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.database.engine import dispose_engine
from app.database.redis import close_redis, init_redis
from app.utils.datetime import utc_now
from app.utils.logging import get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """
    Manage application startup and shutdown resources.

    Initializes optional Redis on startup and disposes database/Redis clients
    on shutdown.
    """
    logger.info("application_startup", extra={"event": "startup"})
    app.state.started_at = utc_now()
    app.state.redis = await init_redis()
    try:
        yield
    finally:
        await close_redis(getattr(app.state, "redis", None))
        await dispose_engine()
        logger.info("application_shutdown", extra={"event": "shutdown"})
