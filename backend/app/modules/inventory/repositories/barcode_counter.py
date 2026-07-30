"""Barcode counter repository."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.inventory.models.barcode_counter import BarcodeCounter
from app.utils.datetime import utc_now


class BarcodeCounterRepository:
    """Persistence helpers for per-prefix barcode sequences."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_for_update(self, prefix: str) -> BarcodeCounter | None:
        """Lock and return the counter row for a prefix."""
        stmt = (
            select(BarcodeCounter)
            .where(BarcodeCounter.prefix == prefix)
            .with_for_update()
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_or_create_for_update(self, prefix: str) -> BarcodeCounter:
        """Lock existing counter or create one at last_value=0 then lock."""
        counter = await self.get_for_update(prefix)
        if counter is not None:
            return counter
        counter = BarcodeCounter(prefix=prefix, last_value=0, updated_at=utc_now())
        self.session.add(counter)
        await self.session.flush()
        locked = await self.get_for_update(prefix)
        assert locked is not None
        return locked

    async def save(self, counter: BarcodeCounter, *, last_value: int) -> BarcodeCounter:
        """Update last_value and flush."""
        counter.last_value = last_value
        counter.updated_at = utc_now()
        await self.session.flush()
        return counter
