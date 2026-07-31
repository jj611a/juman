"""Application lifespan management for startup and shutdown hooks."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.storage_layout import ensure_storage_directories, sync_storage_settings
from app.database.engine import dispose_engine, get_session_factory
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
    ensure_storage_directories()
    try:
        factory = get_session_factory()
        async with factory() as session:
            await sync_storage_settings(session)
    except Exception:  # noqa: BLE001
        logger.exception("storage_layout_sync_failed")
    app.state.redis = await init_redis()
    try:
        yield
    finally:
        await close_redis(getattr(app.state, "redis", None))
        await dispose_engine()
        logger.info("application_shutdown", extra={"event": "shutdown"})
