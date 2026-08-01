"""DressPhoto repository."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import Select, asc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.inventory.models.dress_photo import DressPhoto
from app.repositories.base import AsyncRepository
from app.utils.datetime import utc_now


class DressPhotoRepository(AsyncRepository[DressPhoto]):
    """Persistence helpers for dress gallery photos."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, DressPhoto)

    def _live_for_dress(self, dress_id: UUID) -> Select[tuple[DressPhoto]]:
        return self._base_query().where(DressPhoto.dress_id == dress_id)

    async def list_for_dress(self, dress_id: UUID) -> list[DressPhoto]:
        """Return live photos for a dress ordered by display_order, created_at."""
        stmt = (
            self._live_for_dress(dress_id)
            .order_by(asc(DressPhoto.display_order), asc(DressPhoto.created_at))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_for_dress(self, dress_id: UUID) -> int:
        """Count live photos for a dress."""
        stmt = (
            select(func.count())
            .select_from(DressPhoto)
            .where(
                DressPhoto.dress_id == dress_id,
                DressPhoto.is_deleted.is_(False),
            )
        )
        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    async def max_display_order(self, dress_id: UUID) -> int | None:
        """Return max display_order among live photos, or None if empty."""
        stmt = select(func.max(DressPhoto.display_order)).where(
            DressPhoto.dress_id == dress_id,
            DressPhoto.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        value = result.scalar_one()
        return int(value) if value is not None else None

    async def get_by_dress_and_file(
        self,
        dress_id: UUID,
        stored_file_id: UUID,
    ) -> DressPhoto | None:
        """Return a live photo linking dress to file, if any."""
        stmt = self._live_for_dress(dress_id).where(
            DressPhoto.stored_file_id == stored_file_id
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def clear_cover_for_dress(
        self,
        dress_id: UUID,
        *,
        exclude_id: UUID | None = None,
        actor_id: UUID | None = None,
    ) -> None:
        """Set is_cover=false for all live covers on a dress."""
        stmt = (
            update(DressPhoto)
            .where(
                DressPhoto.dress_id == dress_id,
                DressPhoto.is_deleted.is_(False),
                DressPhoto.is_cover.is_(True),
            )
            .values(is_cover=False, updated_by=actor_id, updated_at=utc_now())
        )
        if exclude_id is not None:
            stmt = stmt.where(DressPhoto.id != exclude_id)
        await self.session.execute(stmt)
        await self.session.flush()
