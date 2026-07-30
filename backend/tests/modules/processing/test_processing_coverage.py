"""Extra processing coverage."""

from uuid import uuid4

import pytest
from app.exceptions import NotFoundError, ValidationError
from app.modules.processing.services.processing import (
    ProcessingService,
    _normalize_notes,
)
from app.modules.processing.services.processing_number import (
    ProcessingNumberConfig,
    ProcessingNumberService,
)
from app.modules.settings.models.setting import Setting
from app.modules.settings.services.setting import SettingService
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


def test_normalize_notes_helper() -> None:
    assert _normalize_notes(None, max_length=10, field="n") is None
    assert _normalize_notes("  ", max_length=10, field="n") is None
    assert _normalize_notes("ok", max_length=10, field="n") == "ok"
    with pytest.raises(ValidationError):
        _normalize_notes("x" * 11, max_length=10, field="n")


@pytest.mark.asyncio
async def test_number_service_and_guards(
    db_session: AsyncSession,
    processing_service: ProcessingService,
    laundry_inspection_item,
) -> None:
    numbers = ProcessingNumberService(db_session, settings=SettingService(db_session))
    config = await numbers.load_config()
    assert numbers.format(1, config=config).startswith("PRC")
    with pytest.raises(ValidationError):
        numbers.format(0, config=config)

    await _set_setting(db_session, "processing.number.prefix", "BAD!")
    with pytest.raises(ValidationError):
        await numbers.load_config()
    await _set_setting(db_session, "processing.number.prefix", "PRC")
    await _set_setting(db_session, "processing.number.separator", "*")
    with pytest.raises(ValidationError):
        await numbers.load_config()
    await _set_setting(db_session, "processing.number.separator", "-")
    await _set_setting(db_session, "processing.number.padding", "0")
    with pytest.raises(ValidationError):
        await numbers.load_config()
    await _set_setting(db_session, "processing.number.padding", "8")
    assert ProcessingNumberConfig(prefix="PRC", separator="-", padding=8)

    batch = await processing_service.create(
        inspection_item_ids=[laundry_inspection_item.id],
    )
    assert "PRC" in repr(batch)
    item = [i for i in batch.items if not i.is_deleted][0]
    assert "ProcessingItem" in repr(item)

    with pytest.raises(ValidationError):
        await processing_service.create(
            inspection_item_ids=[
                laundry_inspection_item.id,
                laundry_inspection_item.id,
            ]
        )
    with pytest.raises(NotFoundError):
        await processing_service.create(inspection_item_ids=[uuid4()])

    started = await processing_service.start(batch.id)
    assert started.status == "IN_PROCESS"
    with pytest.raises(ValidationError):
        await processing_service.start(batch.id)

    with pytest.raises(ValidationError):
        await processing_service.update(batch.id)
    with pytest.raises(ValidationError):
        await processing_service.list(sort_by="nope")
    with pytest.raises(ValidationError):
        await processing_service.list(sort_dir="sideways")

    await _set_setting(db_session, "mandatory_processing_days", "0")
    # optional already false; complete after rewinding mandatory end
    from app.utils.datetime import utc_now

    await processing_service.batches.update_fields(
        started,
        mandatory_processing_end_at=utc_now(),
        final_processing_end_at=utc_now(),
    )
    completed = await processing_service.complete(started.id)
    assert completed.status == "COMPLETED"
    with pytest.raises(ValidationError):
        await processing_service.update(completed.id, notes="بعد")
    with pytest.raises(ValidationError):
        await processing_service.add_optional_day(completed.id)

    # number overflow / collision skip
    config = ProcessingNumberConfig(prefix="PRC", separator="-", padding=1)
    with pytest.raises(ValidationError):
        numbers.format(10, config=config)

    async def _always_taken(*_a: object, **_k: object) -> bool:
        return True

    await _set_setting(db_session, "processing.number.padding", "1")
    numbers.exists = _always_taken  # type: ignore[method-assign]
    with pytest.raises(ValidationError):
        await numbers.generate_next()
    await _set_setting(db_session, "processing.number.padding", "8")


@pytest.mark.asyncio
async def test_pending_inspection_rejected(
    processing_service: ProcessingService,
    rental_service,
    return_service,
    inspection_service,
    sample_customer,
    sample_dress,
) -> None:
    rental = await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=utc(2026, 10, 1),
        expected_return_at=utc(2026, 10, 2),
        initial_payment_type="FIXED_AMOUNT",
        initial_payment_value=0,
        items=[{"dress_id": sample_dress.id}],
    )
    ret = await return_service.create(rental_id=rental.id)
    insp = await inspection_service.create(return_id=ret.id)
    item = [i for i in insp.items if not i.is_deleted][0]
    with pytest.raises(ValidationError):
        await processing_service.create(inspection_item_ids=[item.id])


@pytest.mark.asyncio
async def test_repo_helpers(
    db_session: AsyncSession,
    processing_service: ProcessingService,
    laundry_inspection_item,
) -> None:
    from app.modules.processing.repositories.processing import (
        ProcessingBatchRepository,
        ProcessingItemRepository,
    )

    batch = await processing_service.create(
        inspection_item_ids=[laundry_inspection_item.id],
    )
    repo = ProcessingBatchRepository(db_session)
    found = await repo.get_by_processing_number(
        batch.processing_number,
        exclude_id=uuid4(),
    )
    assert found is not None
    item = [i for i in batch.items if not i.is_deleted][0]
    item_repo = ProcessingItemRepository(db_session)
    assert await item_repo.get_by_id(item.id) is not None
    rows, total = await processing_service.list(dress_id=laundry_inspection_item.dress_id)
    assert total >= 1
    assert rows
