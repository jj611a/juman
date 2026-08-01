"""CalendarService unit tests."""

from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.calendar.constants import CalendarBlockType
from app.modules.calendar.services.calendar import CalendarConflict, CalendarService
from app.modules.inventory.services.dress import DressService
from app.utils.datetime import ensure_utc
from sqlalchemy.ext.asyncio import AsyncSession
from tests.modules.calendar.conftest import utc


@pytest.mark.asyncio
async def test_create_overlap_abut_timeline_availability(
    calendar_service: CalendarService,
    sample_dress,
    db_session: AsyncSession,
) -> None:
    a = await calendar_service.create_block(
        dress_id=sample_dress.id,
        block_type=CalendarBlockType.RESERVATION,
        start_at=utc(2026, 8, 1, 10),
        end_at=utc(2026, 8, 1, 14),
        actor_username="admin",
        reference_module="reservation",
        reference_id=uuid4(),
    )
    # Abutting allowed
    b = await calendar_service.create_block(
        dress_id=sample_dress.id,
        block_type=CalendarBlockType.PROCESSING,
        start_at=utc(2026, 8, 1, 14),
        end_at=utc(2026, 8, 1, 18),
        notes="غسيل",
    )
    assert ensure_utc(b.start_at) == ensure_utc(a.end_at)

    with pytest.raises(ConflictError) as exc:
        await calendar_service.create_block(
            dress_id=sample_dress.id,
            block_type=CalendarBlockType.RENTAL,
            start_at=utc(2026, 8, 1, 13),
            end_at=utc(2026, 8, 1, 15),
        )
    assert "conflicts" in exc.value.details
    assert exc.value.details["conflicts"][0]["conflict_kind"] == "overlap"

    timeline = await calendar_service.get_timeline(sample_dress.id)
    assert [t.id for t in timeline] == [a.id, b.id]

    windowed = await calendar_service.get_timeline(
        sample_dress.id,
        window_from=utc(2026, 8, 1, 12),
        window_to=utc(2026, 8, 1, 15),
    )
    assert len(windowed) == 2

    only_from = await calendar_service.get_timeline(
        sample_dress.id,
        window_from=utc(2026, 8, 1, 17),
    )
    assert [t.id for t in only_from] == [b.id]

    only_to = await calendar_service.get_timeline(
        sample_dress.id,
        window_to=utc(2026, 8, 1, 12),
    )
    assert [t.id for t in only_to] == [a.id]

    assert await calendar_service.is_available(
        sample_dress.id,
        utc(2026, 8, 1, 18),
        utc(2026, 8, 1, 20),
    )
    assert not await calendar_service.is_available(
        sample_dress.id,
        utc(2026, 8, 1, 12),
        utc(2026, 8, 1, 13),
    )

    conflicts = await calendar_service.get_conflicts(
        sample_dress.id,
        utc(2026, 8, 1, 12),
        utc(2026, 8, 1, 15),
    )
    assert len(conflicts) == 2
    assert {c.block_type for c in conflicts} == {"RESERVATION", "PROCESSING"}
    assert isinstance(conflicts[0], CalendarConflict)

    audit = AuditService(db_session)
    logs, _ = await audit.list_logs(module="calendar", entity_id=str(a.id))
    assert any(row.action == AuditAction.CREATE.value for row in logs)


@pytest.mark.asyncio
async def test_move_and_delete(
    calendar_service: CalendarService,
    sample_dress,
) -> None:
    block = await calendar_service.create_block(
        dress_id=sample_dress.id,
        block_type="MAINTENANCE",
        start_at=utc(2026, 9, 1),
        end_at=utc(2026, 9, 2),
    )
    other = await calendar_service.create_block(
        dress_id=sample_dress.id,
        block_type=CalendarBlockType.RENTAL,
        start_at=utc(2026, 9, 5),
        end_at=utc(2026, 9, 6),
    )

    moved = await calendar_service.move_block(
        block.id,
        start_at=utc(2026, 9, 3),
        end_at=utc(2026, 9, 4),
        notes="نقل",
    )
    assert ensure_utc(moved.start_at) == utc(2026, 9, 3)

    with pytest.raises(ConflictError):
        await calendar_service.move_block(
            block.id,
            start_at=utc(2026, 9, 4, 12),
            end_at=utc(2026, 9, 5, 12),
        )

    typed = await calendar_service.move_block(
        block.id,
        block_type=CalendarBlockType.PROCESSING,
        clear_notes=True,
    )
    assert typed.block_type == CalendarBlockType.PROCESSING.value
    assert typed.notes is None

    await calendar_service.remove_block(other.id)
    # After delete, move into former slot is free
    moved2 = await calendar_service.move_block(
        block.id,
        start_at=utc(2026, 9, 5),
        end_at=utc(2026, 9, 6),
    )
    assert ensure_utc(moved2.start_at) == utc(2026, 9, 5)
    timeline = await calendar_service.get_timeline(sample_dress.id)
    assert len(timeline) == 1


@pytest.mark.asyncio
async def test_next_available_date(
    calendar_service: CalendarService,
    sample_dress,
) -> None:
    await calendar_service.create_block(
        dress_id=sample_dress.id,
        block_type=CalendarBlockType.RESERVATION,
        start_at=utc(2026, 10, 1, 10),
        end_at=utc(2026, 10, 1, 14),
    )
    await calendar_service.create_block(
        dress_id=sample_dress.id,
        block_type=CalendarBlockType.RENTAL,
        start_at=utc(2026, 10, 1, 16),
        end_at=utc(2026, 10, 1, 20),
    )

    # Immediately available for 1h before first block
    nxt = await calendar_service.next_available_date(
        sample_dress.id,
        after=utc(2026, 10, 1, 8),
        duration=timedelta(hours=1),
    )
    assert nxt == utc(2026, 10, 1, 8)

    # Need 3h starting at 9 → gap before first is only to 10; jump after first ends at 14
    # At 14, next block starts 16 → 2h gap; need 3h → jump to 20
    nxt2 = await calendar_service.next_available_date(
        sample_dress.id,
        after=utc(2026, 10, 1, 9),
        duration=timedelta(hours=3),
    )
    assert nxt2 == utc(2026, 10, 1, 20)

    # Starting mid-block → skip past it
    nxt3 = await calendar_service.next_available_date(
        sample_dress.id,
        after=utc(2026, 10, 1, 12),
        duration=timedelta(hours=1),
    )
    assert nxt3 == utc(2026, 10, 1, 14)

    with pytest.raises(ValidationError):
        await calendar_service.next_available_date(
            sample_dress.id,
            after=datetime(2026, 10, 1),
            duration=timedelta(hours=1),
        )
    with pytest.raises(ValidationError):
        await calendar_service.next_available_date(
            sample_dress.id,
            after=utc(2026, 10, 1, 8),
            duration=timedelta(0),
        )


@pytest.mark.asyncio
async def test_validation_and_missing(
    calendar_service: CalendarService,
    sample_dress,
) -> None:
    with pytest.raises(ValidationError):
        await calendar_service.create_block(
            dress_id=sample_dress.id,
            block_type="NOPE",
            start_at=utc(2026, 11, 1),
            end_at=utc(2026, 11, 2),
        )
    with pytest.raises(ValidationError):
        await calendar_service.create_block(
            dress_id=sample_dress.id,
            block_type=CalendarBlockType.RENTAL,
            start_at=utc(2026, 11, 2),
            end_at=utc(2026, 11, 1),
        )
    with pytest.raises(ValidationError):
        await calendar_service.create_block(
            dress_id=sample_dress.id,
            block_type=CalendarBlockType.RENTAL,
            start_at=datetime(2026, 11, 1),
            end_at=datetime(2026, 11, 2),
        )
    with pytest.raises(ValidationError):
        await calendar_service.create_block(
            dress_id=sample_dress.id,
            block_type=CalendarBlockType.RENTAL,
            start_at=utc(2026, 11, 1),
            end_at=utc(2026, 11, 2),
            reference_module="x" * 51,
        )
    with pytest.raises(ValidationError):
        await calendar_service.create_block(
            dress_id=sample_dress.id,
            block_type=CalendarBlockType.RENTAL,
            start_at=utc(2026, 11, 1),
            end_at=utc(2026, 11, 2),
            notes="ن" * 1001,
        )
    with pytest.raises(NotFoundError):
        await calendar_service.create_block(
            dress_id=uuid4(),
            block_type=CalendarBlockType.RENTAL,
            start_at=utc(2026, 11, 1),
            end_at=utc(2026, 11, 2),
        )
    with pytest.raises(NotFoundError):
        await calendar_service.get_block(uuid4())

    blank_ref = await calendar_service.create_block(
        dress_id=sample_dress.id,
        block_type=CalendarBlockType.RENTAL,
        start_at=utc(2026, 11, 1),
        end_at=utc(2026, 11, 2),
        reference_module="  ",
        notes="  ",
    )
    assert blank_ref.reference_module is None
    assert blank_ref.notes is None

    with pytest.raises(ValidationError):
        await calendar_service.get_timeline(
            sample_dress.id,
            window_from=datetime(2026, 11, 1),
        )
    with pytest.raises(ValidationError):
        await calendar_service.get_timeline(
            sample_dress.id,
            window_to=datetime(2026, 11, 2),
        )

    await calendar_service.move_block(blank_ref.id, notes="محدث")
    with pytest.raises(ValidationError):
        await calendar_service.move_block(blank_ref.id, notes="ن" * 1001)


@pytest.mark.asyncio
async def test_soft_deleted_dress_rejected(
    calendar_service: CalendarService,
    dress_service: DressService,
    sample_dress,
) -> None:
    await dress_service.soft_delete(sample_dress.id)
    with pytest.raises(NotFoundError):
        await calendar_service.is_available(
            sample_dress.id,
            utc(2026, 12, 1),
            utc(2026, 12, 2),
        )
