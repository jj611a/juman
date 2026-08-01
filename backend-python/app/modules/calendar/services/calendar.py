"""CalendarService — dress timeline, conflicts, and availability."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.calendar.constants import CalendarBlockType
from app.modules.calendar.models.dress_calendar_block import DressCalendarBlock
from app.modules.calendar.repositories.dress_calendar_block import DressCalendarBlockRepository
from app.modules.inventory.repositories.dress import DressRepository
from app.services.base import BaseService
from app.utils.datetime import ensure_utc, utc_now


@dataclass(frozen=True, slots=True)
class CalendarConflict:
    """One overlapping block against a proposed interval."""

    block_id: UUID
    block_type: str
    start_at: datetime
    end_at: datetime
    reference_module: str | None
    reference_id: UUID | None
    conflict_kind: str = "overlap"

    def as_dict(self) -> dict[str, Any]:
        return {
            "block_id": str(self.block_id),
            "block_type": self.block_type,
            "start_at": self.start_at.isoformat(),
            "end_at": self.end_at.isoformat(),
            "reference_module": self.reference_module,
            "reference_id": str(self.reference_id) if self.reference_id else None,
            "conflict_kind": self.conflict_kind,
        }


def _snapshot(block: DressCalendarBlock) -> dict[str, Any]:
    return {
        "dress_id": str(block.dress_id),
        "block_type": block.block_type,
        "reference_module": block.reference_module,
        "reference_id": str(block.reference_id) if block.reference_id else None,
        "start_at": ensure_utc(block.start_at).isoformat(),
        "end_at": ensure_utc(block.end_at).isoformat(),
        "notes": block.notes,
    }


def _normalize_block_type(value: str | CalendarBlockType) -> str:
    if isinstance(value, CalendarBlockType):
        return value.value
    raw = value.strip().upper()
    try:
        return CalendarBlockType(raw).value
    except ValueError as exc:
        raise ValidationError(
            "نوع كتلة التقويم غير صالح",
            details={
                "field": "block_type",
                "allowed": [t.value for t in CalendarBlockType],
            },
        ) from exc


def _validate_interval(start_at: datetime, end_at: datetime) -> tuple[datetime, datetime]:
    """Require timezone-aware bounds; return UTC-normalized pair."""
    if start_at.tzinfo is None or end_at.tzinfo is None:
        raise ValidationError(
            "يجب أن تكون أوقات التقويم بمنطقة زمنية",
            details={"field": "start_at"},
        )
    start_utc = ensure_utc(start_at)
    end_utc = ensure_utc(end_at)
    if end_utc <= start_utc:
        raise ValidationError(
            "وقت النهاية يجب أن يكون بعد وقت البداية",
            details={"field": "end_at"},
        )
    return start_utc, end_utc


class CalendarService(BaseService):
    """Scheduling-only availability engine for dress timelines."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        blocks: DressCalendarBlockRepository | None = None,
        dresses: DressRepository | None = None,
        audit: AuditService | None = None,
    ) -> None:
        super().__init__(session)
        self.blocks = blocks or DressCalendarBlockRepository(session)
        self.dresses = dresses or DressRepository(session)
        self.audit = audit or AuditService(session)

    async def _require_dress(self, dress_id: UUID) -> None:
        dress = await self.dresses.get_by_id(dress_id)
        if dress is None:
            raise NotFoundError("الفستان غير موجود")

    async def get_block(self, block_id: UUID) -> DressCalendarBlock:
        """Return a live calendar block or raise NotFoundError."""
        block = await self.blocks.get_by_id(block_id)
        if block is None:
            raise NotFoundError("كتلة التقويم غير موجودة")
        return block

    def _to_conflicts(self, rows: list[DressCalendarBlock]) -> list[CalendarConflict]:
        return [
            CalendarConflict(
                block_id=row.id,
                block_type=row.block_type,
                start_at=ensure_utc(row.start_at),
                end_at=ensure_utc(row.end_at),
                reference_module=row.reference_module,
                reference_id=row.reference_id,
            )
            for row in rows
        ]

    async def get_conflicts(
        self,
        dress_id: UUID,
        start_at: datetime,
        end_at: datetime,
        *,
        exclude_block_id: UUID | None = None,
    ) -> list[CalendarConflict]:
        """Return structured overlaps for a proposed interval."""
        await self._require_dress(dress_id)
        start_at, end_at = _validate_interval(start_at, end_at)
        rows = await self.blocks.list_overlapping(
            dress_id,
            start_at=start_at,
            end_at=end_at,
            exclude_id=exclude_block_id,
        )
        return self._to_conflicts(rows)

    async def is_available(
        self,
        dress_id: UUID,
        start_at: datetime,
        end_at: datetime,
    ) -> bool:
        """True when no live blocks overlap the interval."""
        conflicts = await self.get_conflicts(dress_id, start_at, end_at)
        return len(conflicts) == 0

    async def get_timeline(
        self,
        dress_id: UUID,
        *,
        window_from: datetime | None = None,
        window_to: datetime | None = None,
    ) -> list[DressCalendarBlock]:
        """Ordered live blocks for a dress."""
        await self._require_dress(dress_id)
        if window_from is not None and window_from.tzinfo is None:
            raise ValidationError(
                "يجب أن تكون أوقات التقويم بمنطقة زمنية",
                details={"field": "from"},
            )
        if window_to is not None and window_to.tzinfo is None:
            raise ValidationError(
                "يجب أن تكون أوقات التقويم بمنطقة زمنية",
                details={"field": "to"},
            )
        if window_from is not None and window_to is not None:
            window_from, window_to = _validate_interval(window_from, window_to)
        elif window_from is not None:
            window_from = ensure_utc(window_from)
        elif window_to is not None:
            window_to = ensure_utc(window_to)
        return await self.blocks.list_for_dress(
            dress_id,
            window_from=window_from,
            window_to=window_to,
        )

    async def next_available_date(
        self,
        dress_id: UUID,
        *,
        after: datetime,
        duration: timedelta,
    ) -> datetime | None:
        """
        Earliest ``t >= after`` such that ``[t, t+duration)`` has no overlaps.

        Scans sorted busy blocks and free gaps. Returns ``None`` if no gap found
        before the last block's end plus a one-step open end (open-ended horizon
        after the last block always succeeds).
        """
        await self._require_dress(dress_id)
        if after.tzinfo is None:
            raise ValidationError(
                "يجب أن يكون وقت البحث بمنطقة زمنية",
                details={"field": "after"},
            )
        if duration <= timedelta(0):
            raise ValidationError(
                "مدة البحث يجب أن تكون أكبر من صفر",
                details={"field": "duration"},
            )

        after = ensure_utc(after)
        blocks = await self.blocks.list_for_dress(dress_id, window_from=after)
        cursor = after
        needed = duration

        for block in blocks:
            block_start = ensure_utc(block.start_at)
            block_end = ensure_utc(block.end_at)
            if block_end <= cursor:
                continue
            if block_start >= cursor + needed:
                return cursor
            if block_start > cursor:
                # Gap [cursor, block.start_at) too short — jump past block
                pass
            cursor = max(cursor, block_end)
        return cursor

    async def create_block(
        self,
        *,
        dress_id: UUID,
        block_type: str | CalendarBlockType,
        start_at: datetime,
        end_at: datetime,
        reference_module: str | None = None,
        reference_id: UUID | None = None,
        notes: str | None = None,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> DressCalendarBlock:
        """Create a busy block; reject on overlap."""
        await self._require_dress(dress_id)
        start_at, end_at = _validate_interval(start_at, end_at)
        type_value = _normalize_block_type(block_type)

        conflicts = await self.get_conflicts(dress_id, start_at, end_at)
        if conflicts:
            raise ConflictError(
                "فترة التقويم تتعارض مع كتلة موجودة",
                details={"conflicts": [c.as_dict() for c in conflicts]},
            )

        ref_module = None
        if reference_module is not None:
            stripped = reference_module.strip().lower()
            ref_module = stripped or None
            if ref_module is not None and len(ref_module) > 50:
                raise ValidationError(
                    "مرجع الوحدة أطول من الحد المسموح",
                    details={"field": "reference_module"},
                )

        notes_value = None
        if notes is not None:
            stripped = notes.strip()
            notes_value = stripped or None
            if notes_value is not None and len(notes_value) > 1000:
                raise ValidationError(
                    "الملاحظات أطول من الحد المسموح",
                    details={"field": "notes"},
                )

        block = DressCalendarBlock(
            dress_id=dress_id,
            block_type=type_value,
            reference_module=ref_module,
            reference_id=reference_id,
            start_at=start_at,
            end_at=end_at,
            notes=notes_value,
            created_by=actor_id,
            updated_by=actor_id,
        )
        block = await self.blocks.add(block)
        await self.audit.record_create(
            module="calendar",
            entity_type="DressCalendarBlock",
            entity_id=block.id,
            new_values=_snapshot(block),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
        )
        return block

    async def move_block(
        self,
        block_id: UUID,
        *,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
        block_type: str | CalendarBlockType | None = None,
        notes: str | None = None,
        clear_notes: bool = False,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> DressCalendarBlock:
        """Update interval and/or notes; re-validate overlaps when times change."""
        block = await self.get_block(block_id)
        old_values = _snapshot(block)

        new_start = start_at if start_at is not None else ensure_utc(block.start_at)
        new_end = end_at if end_at is not None else ensure_utc(block.end_at)
        new_start, new_end = _validate_interval(new_start, new_end)

        conflicts = await self.get_conflicts(
            block.dress_id,
            new_start,
            new_end,
            exclude_block_id=block.id,
        )
        if conflicts:
            raise ConflictError(
                "فترة التقويم تتعارض مع كتلة موجودة",
                details={"conflicts": [c.as_dict() for c in conflicts]},
            )

        fields: dict[str, object] = {
            "start_at": new_start,
            "end_at": new_end,
            "updated_by": actor_id,
            "updated_at": utc_now(),
        }
        if block_type is not None:
            fields["block_type"] = _normalize_block_type(block_type)
        if clear_notes:
            fields["notes"] = None
        elif notes is not None:
            stripped = notes.strip()
            value = stripped or None
            if value is not None and len(value) > 1000:
                raise ValidationError(
                    "الملاحظات أطول من الحد المسموح",
                    details={"field": "notes"},
                )
            fields["notes"] = value

        block = await self.blocks.update_fields(block, **fields)
        await self.audit.record_update(
            module="calendar",
            entity_type="DressCalendarBlock",
            entity_id=block.id,
            old_values=old_values,
            new_values=_snapshot(block),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
        )
        return block

    async def remove_block(
        self,
        block_id: UUID,
        *,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> None:
        """Soft-delete a calendar block."""
        block = await self.get_block(block_id)
        old_values = _snapshot(block)
        await self.blocks.delete(block, deleted_by=actor_id)
        await self.audit.record_delete(
            module="calendar",
            entity_type="DressCalendarBlock",
            entity_id=block_id,
            old_values=old_values,
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
        )
