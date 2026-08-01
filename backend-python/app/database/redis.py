"""Optional Redis client factory and health helpers."""

from redis.asyncio import Redis

from app.config import get_settings
from app.utils.logging import get_logger

logger = get_logger(__name__)


async def init_redis() -> Redis | None:
    """
    Initialize an async Redis client when configured.

    Returns ``None`` when Redis is disabled or unconfigured so the API can
    boot without Redis.
    """
    settings = get_settings()
    if not settings.redis_is_configured:
        logger.info("redis_disabled")
        return None

    assert settings.redis_url is not None
    client = Redis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
    )
    logger.info("redis_initialized")
    return client


async def close_redis(client: Redis | None) -> None:
    """Close the Redis client if it was initialized."""
    if client is not None:
        await client.aclose()
        logger.info("redis_closed")


async def ping_redis(client: Redis | None) -> str:
    """
    Probe Redis connectivity for health checks.

    Returns one of: ``disabled``, ``up``, ``down``.
    """
    if client is None:
        return "disabled"
    try:
        pong = await client.ping()
        return "up" if pong else "down"
    except Exception:
        logger.exception("redis_ping_failed")
        return "down"
