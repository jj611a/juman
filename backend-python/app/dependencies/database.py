"""Database session dependency."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_async_session


async def get_db() -> AsyncGenerator[AsyncSession]:
    """Provide a request-scoped async SQLAlchemy session."""
    async for session in get_async_session():
        yield session
