"""Persistence operations for system settings."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.settings.enums import SettingCategory
from app.modules.settings.models.setting import Setting
from app.repositories.base import AsyncRepository


class SettingRepository(AsyncRepository[Setting]):
    """Repository for ``Setting`` entities."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Setting)

    async def get_by_key(self, key: str, *, include_deleted: bool = False) -> Setting | None:
        """Fetch a setting by its unique key."""
        stmt = self._base_query(include_deleted=include_deleted).where(Setting.key == key)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(
        self,
        *,
        category: SettingCategory | str | None = None,
        include_deleted: bool = False,
    ) -> list[Setting]:
        """List settings, optionally filtered by category."""
        stmt = self._base_query(include_deleted=include_deleted).order_by(
            Setting.category.asc(),
            Setting.key.asc(),
        )
        if category is not None:
            stmt = stmt.where(Setting.category == str(category))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_keys(self, *, include_deleted: bool = False) -> set[str]:
        """Return the set of existing setting keys."""
        stmt = select(Setting.key)
        if not include_deleted:
            stmt = stmt.where(Setting.is_deleted.is_(False))
        result = await self.session.execute(stmt)
        return set(result.scalars().all())
