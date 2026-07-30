"""Base application service for use-case orchestration."""

from sqlalchemy.ext.asyncio import AsyncSession


class BaseService:
    """
    Thin base for module services.

    Services own business orchestration and receive an async session via DI.
    Persistence goes through repositories — never through routers.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
