"""ProcessingService unit tests."""

from uuid import uuid4

import pytest
from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.calendar.constants import CalendarBlockType
from app.modules.calendar.services.calendar import CalendarService
from app.modules.inventory.constants import DressStatus
from app.modules.inventory.services.dress_status import DressStatusService
from app.modules.processing.constants import ProcessingStatus
from app.modules.processing.services.processing import ProcessingService
from app.modules.settings.models.setting import Setting
from app.utils.datetime import ensure_utc
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.modules.processing.conftest import utc


async def _set_setting(session: AsyncSession, key: str, value: str) -> None:
    result = await session.execute(
        select(Setting).where(Setting.key == key, Setting.is_deleted.is_(False))
    )
    row = result.scalar_one()
    row.value = value
    await session.flush()


@pytest.mark.asyncio
async def test_create_start_optional_complete_flow(
    processing_service: ProcessingService,
    laundry_inspection_item,
    sample_dress,
    db_session: AsyncSession,
) -> None:
    await _set_setting(db_session, "mandatory_processing_days", "0")
    await _set_setting(db_session, "optional_processing_days", "1")

    batch = await processing_service.create(
        inspection_item_ids=[laundry_inspection_item.id],
        notes="دفعة غسيل",
    )
    assert batch.status == ProcessingStatus.PENDING.value
    assert batch.processing_number.startswith("PRC")
    assert len([i for i in batch.items if not i.is_deleted]) == 1

    with pytest.raises(ConflictError):
        await processing_service.create(inspection_item_ids=[laundry_inspection_item.id])

    started = await processing_service.start(batch.id, enable_optional_day=False)
    assert started.status == ProcessingStatus.IN_PROCESS.value
    assert started.started_at is not None
    assert started.optional_extra_day_enabled is False
    item = [i for i in started.items if not i.is_deleted][0]
    assert item.calendar_block_id is not None
    assert item.status == ProcessingStatus.IN_PROCESS.value

    calendar = CalendarService(db_session)
    proc_block = await calendar.get_block(item.calendar_block_id)
    assert proc_block.block_type == CalendarBlockType.PROCESSING.value

    from app.modules.calendar.repositories.dress_calendar_block import (
        DressCalendarBlockRepository,
    )

    repo = DressCalendarBlockRepository(db_session)
    blocks = await repo.list_for_dress(sample_dress.id)
    rental = [b for b in blocks if b.block_type == "RENTAL" and not b.is_deleted]
    if rental:
        assert ensure_utc(rental[0].end_at) == ensure_utc(started.started_at)

    extended = await processing_service.add_optional_day(started.id)
    assert extended.optional_extra_day_enabled is True
    assert extended.final_processing_end_at is not None
    assert ensure_utc(extended.final_processing_end_at) > ensure_utc(
        extended.mandatory_processing_end_at  # type: ignore[arg-type]
    )
    with pytest.raises(ValidationError):
        await processing_service.add_optional_day(extended.id)

    completed = await processing_service.complete(extended.id)
    assert completed.status == ProcessingStatus.COMPLETED.value
    status_svc = DressStatusService(db_session)
    assert await status_svc.get_current_status(sample_dress.id) == DressStatus.AVAILABLE.value

    audit = AuditService(db_session)
    logs, _ = await audit.list_logs(module="processing", entity_id=str(batch.id))
    actions = {row.action for row in logs}
    assert AuditAction.CREATE.value in actions
    assert AuditAction.COMPLETE.value in actions
    assert AuditAction.CUSTOM.value in actions

    with pytest.raises(ValidationError):
        await processing_service.complete(batch.id)


@pytest.mark.asyncio
async def test_complete_before_mandatory_rejected(
    processing_service: ProcessingService,
    laundry_inspection_item,
) -> None:
    batch = await processing_service.create(
        inspection_item_ids=[laundry_inspection_item.id],
    )
    await processing_service.start(batch.id)
    with pytest.raises(ValidationError):
        await processing_service.complete(batch.id)


@pytest.mark.asyncio
async def test_rejects_major_and_no_laundry(
    processing_service: ProcessingService,
    rental_service,
    return_service,
    inspection_service,
    dress_service,
    sample_customer,
    sample_category,
) -> None:
    d = await dress_service.create_dress(
        category_id=sample_category.id,
        name_ar="ضرر جسيم",
        size="L",
        colour="BLACK",
        purchase_price=900,
        default_daily_rental_price=90,
        default_sale_price=1800,
    )
    rental = await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=utc(2026, 9, 1),
        expected_return_at=utc(2026, 9, 3),
        initial_payment_type="FIXED_AMOUNT",
        initial_payment_value=0,
        items=[{"dress_id": d.id}],
    )
    ret = await return_service.create(rental_id=rental.id)
    insp = await inspection_service.create(return_id=ret.id)
    item = [i for i in insp.items if not i.is_deleted][0]
    await inspection_service.update(
        insp.id,
        items=[
            {
                "id": item.id,
                "condition": "MAJOR_DAMAGE",
                "send_to_ruined": True,
                "requires_laundry": False,
            }
        ],
        complete=True,
    )
    insp = await inspection_service.get(insp.id)
    major_item = [i for i in insp.items if not i.is_deleted][0]
    with pytest.raises(ValidationError):
        await processing_service.create(inspection_item_ids=[major_item.id])

    d2 = await dress_service.create_dress(
        category_id=sample_category.id,
        name_ar="بدون غسيل",
        size="S",
        colour="WHITE",
        purchase_price=700,
        default_daily_rental_price=70,
        default_sale_price=1400,
    )
    rental2 = await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=utc(2026, 9, 5),
        expected_return_at=utc(2026, 9, 6),
        initial_payment_type="FIXED_AMOUNT",
        initial_payment_value=0,
        items=[{"dress_id": d2.id}],
    )
    ret2 = await return_service.create(rental_id=rental2.id)
    insp2 = await inspection_service.create(return_id=ret2.id)
    item2 = [i for i in insp2.items if not i.is_deleted][0]
    await inspection_service.update(
        insp2.id,
        items=[{"id": item2.id, "condition": "GOOD", "requires_laundry": False}],
        complete=True,
    )
    insp2 = await inspection_service.get(insp2.id)
    clean = [i for i in insp2.items if not i.is_deleted][0]
    with pytest.raises(ValidationError):
        await processing_service.create(inspection_item_ids=[clean.id])


@pytest.mark.asyncio
async def test_list_and_update_notes(
    processing_service: ProcessingService,
    laundry_inspection_item,
) -> None:
    batch = await processing_service.create(
        inspection_item_ids=[laundry_inspection_item.id],
        notes="أولية",
    )
    updated = await processing_service.update(batch.id, notes="محدّثة")
    assert updated.notes == "محدّثة"
    cleared = await processing_service.update(batch.id, clear_notes=True)
    assert cleared.notes is None

    rows, total = await processing_service.list(
        status="pending",
        dress_id=laundry_inspection_item.dress_id,
    )
    assert total == 1
    assert rows[0].id == batch.id

    with pytest.raises(NotFoundError):
        await processing_service.get(uuid4())
    with pytest.raises(ValidationError):
        await processing_service.list(status="NOPE")
    with pytest.raises(ValidationError):
        await processing_service.create(inspection_item_ids=[])
