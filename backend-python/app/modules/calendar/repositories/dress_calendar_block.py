"""DressCalendarBlock repository."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, and_, asc
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.calendar.models.dress_calendar_block import DressCalendarBlock
from app.repositories.base import AsyncRepository


class DressCalendarBlockRepository(AsyncRepository[DressCalendarBlock]):
    """Persistence helpers for dress calendar blocks."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, DressCalendarBlock)

    def _live_for_dress(self, dress_id: UUID) -> Select[tuple[DressCalendarBlock]]:
        return self._base_query().where(DressCalendarBlock.dress_id == dress_id)

    async def list_for_dress(
        self,
        dress_id: UUID,
        *,
        window_from: datetime | None = None,
        window_to: datetime | None = None,
    ) -> list[DressCalendarBlock]:
        """Return live blocks for a dress, optionally intersecting a window."""
        stmt = self._live_for_dress(dress_id)
        if window_from is not None and window_to is not None:
            # Intersect [window_from, window_to): block.start < window_to AND block.end > window_from
            stmt = stmt.where(
                and_(
                    DressCalendarBlock.start_at < window_to,
                    DressCalendarBlock.end_at > window_from,
                )
            )
        elif window_from is not None:
            stmt = stmt.where(DressCalendarBlock.end_at > window_from)
        elif window_to is not None:
            stmt = stmt.where(DressCalendarBlock.start_at < window_to)
        stmt = stmt.order_by(asc(DressCalendarBlock.start_at), asc(DressCalendarBlock.end_at))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_overlapping(
        self,
        dress_id: UUID,
        *,
        start_at: datetime,
        end_at: datetime,
        exclude_id: UUID | None = None,
    ) -> list[DressCalendarBlock]:
        """Return live blocks that overlap [start_at, end_at)."""
        stmt = self._live_for_dress(dress_id).where(
            and_(
                DressCalendarBlock.start_at < end_at,
                DressCalendarBlock.end_at > start_at,
            )
        )
        if exclude_id is not None:
            stmt = stmt.where(DressCalendarBlock.id != exclude_id)
        stmt = stmt.order_by(asc(DressCalendarBlock.start_at), asc(DressCalendarBlock.end_at))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
