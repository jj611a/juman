"""Async session helpers used by dependencies and repositories."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from app.database.engine import get_session_factory


async def get_async_session() -> AsyncGenerator[AsyncSession]:
    """
    Yield an async database session with commit/rollback semantics.

    Commits on successful request completion; rolls back on exceptions.
    """
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
