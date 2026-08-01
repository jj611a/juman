"""Permission persistence operations."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.rbac.models.permission import Permission
from app.repositories.base import AsyncRepository


class PermissionRepository(AsyncRepository[Permission]):
    """Repository for ``Permission`` entities."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Permission)

    async def get_by_key(self, key: str, *, include_deleted: bool = False) -> Permission | None:
        """Fetch a permission by its unique key."""
        stmt = self._base_query(include_deleted=include_deleted).where(Permission.key == key)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(
        self,
        *,
        module: str | None = None,
        include_deleted: bool = False,
    ) -> list[Permission]:
        """List permissions, optionally filtered by module."""
        stmt = self._base_query(include_deleted=include_deleted).order_by(
            Permission.module.asc(),
            Permission.key.asc(),
        )
        if module is not None:
            stmt = stmt.where(Permission.module == module)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_keys(self, *, include_deleted: bool = False) -> set[str]:
        """Return the set of existing permission keys."""
        stmt = select(Permission.key)
        if not include_deleted:
            stmt = stmt.where(Permission.is_deleted.is_(False))
        result = await self.session.execute(stmt)
        return set(result.scalars().all())

    async def get_by_keys(
        self,
        keys: list[str] | set[str] | tuple[str, ...],
        *,
        include_deleted: bool = False,
    ) -> list[Permission]:
        """Fetch multiple permissions by key."""
        if not keys:
            return []
        stmt = self._base_query(include_deleted=include_deleted).where(
            Permission.key.in_(list(keys))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
