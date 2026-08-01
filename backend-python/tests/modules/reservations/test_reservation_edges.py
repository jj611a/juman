"""Extra reservation edge-case coverage."""

from datetime import datetime
from uuid import uuid4

import pytest
from app.exceptions import NotFoundError, ValidationError
from app.modules.reservations.constants import ReservationSortField
from app.modules.reservations.schemas.reservation import (
    ReservationCreateRequest,
    ReservationItemInput,
    ReservationUpdateRequest,
)
from app.modules.reservations.services.reservation import ReservationService
from app.modules.reservations.services.reservation_number import (
    ReservationNumberConfig,
    ReservationNumberService,
)
from app.modules.settings.models.setting import Setting
from app.modules.settings.services.setting import SettingService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.modules.reservations.conftest import utc


@pytest.mark.asyncio
async def test_list_filters_and_update_edges(
    reservation_service: ReservationService,
    sample_customer,
    sample_dress,
    sample_dress_b,
) -> None:
    draft = await reservation_service.create(
        customer_id=sample_customer.id,
        reservation_at=utc(2026, 7, 1),
        rental_start_at=utc(2026, 8, 1),
        expected_return_at=utc(2026, 8, 2),
        items=[{"dress_id": sample_dress.id}],
    )
    await reservation_service.create(
        customer_id=sample_customer.id,
        reservation_at=utc(2026, 7, 1),
        rental_start_at=utc(2026, 9, 1),
        expected_return_at=utc(2026, 9, 2),
        items=[{"dress_id": sample_dress_b.id}],
    )

    items, total = await reservation_service.list(
        status="draft",
        customer_id=sample_customer.id,
        rental_from=utc(2026, 8, 1),
        rental_to=utc(2026, 8, 15),
        sort_by=ReservationSortField.RENTAL_START_AT,
        sort_dir="asc",
    )
    assert total == 1
    assert items[0].id == draft.id

    with pytest.raises(ValidationError):
        await reservation_service.list(sort_by="nope")
    with pytest.raises(ValidationError):
        await reservation_service.list(sort_dir="sideways")
    with pytest.raises(ValidationError):
        await reservation_service.list(status="NOPE")

    updated = await reservation_service.update(
        draft.id,
        customer_id=sample_customer.id,
        clear_notes=True,
        notes="ignored-when-clear",
    )
    assert updated.notes is None

    with pytest.raises(NotFoundError):
        await reservation_service.get(uuid4())

    with pytest.raises(ValidationError):
        await reservation_service.create(
            customer_id=sample_customer.id,
            reservation_at=datetime(2026, 7, 1),
            rental_start_at=datetime(2026, 8, 1),
            expected_return_at=datetime(2026, 8, 2),
            items=[{"dress_id": sample_dress.id}],
        )

    with pytest.raises(ValidationError):
        await reservation_service.create(
            customer_id=sample_customer.id,
            reservation_at=utc(2026, 7, 1),
            rental_start_at=utc(2026, 8, 1),
            expected_return_at=utc(2026, 8, 2),
            items=[{"dress_id": sample_dress.id, "reserved_daily_rental_price": -1}],
        )

    with pytest.raises(ValidationError):
        await reservation_service.create(
            customer_id=sample_customer.id,
            reservation_at=utc(2026, 7, 1),
            rental_start_at=utc(2026, 8, 1),
            expected_return_at=utc(2026, 8, 2),
            notes="ن" * 2001,
            items=[{"dress_id": sample_dress.id}],
        )

    with pytest.raises(NotFoundError):
        await reservation_service.create(
            customer_id=sample_customer.id,
            reservation_at=utc(2026, 7, 1),
            rental_start_at=utc(2026, 8, 1),
            expected_return_at=utc(2026, 8, 2),
            items=[{"dress_id": uuid4()}],
        )

    cancelled = await reservation_service.cancel(draft.id)
    assert cancelled.status == "CANCELLED"
    with pytest.raises(ValidationError):
        await reservation_service.cancel(cancelled.id)


async def _set_setting_raw(session: AsyncSession, key: str, value: str) -> None:
    result = await session.execute(
        select(Setting).where(Setting.key == key, Setting.is_deleted.is_(False))
    )
    row = result.scalar_one()
    row.value = value
    await session.flush()


@pytest.mark.asyncio
async def test_number_service_and_schema_validators(
    db_session: AsyncSession,
    reservation_service: ReservationService,
) -> None:
    numbers = ReservationNumberService(db_session, settings=SettingService(db_session))
    config = await numbers.load_config()
    assert numbers.format(1, config=config).startswith("RSV")
    with pytest.raises(ValidationError):
        numbers.format(0, config=config)
    with pytest.raises(ValidationError):
        numbers.format(10**config.padding + 1, config=config)

    await _set_setting_raw(db_session, "reservations.number.prefix", "BAD!")
    with pytest.raises(ValidationError):
        await numbers.load_config()
    await _set_setting_raw(db_session, "reservations.number.prefix", "RSV")

    await _set_setting_raw(db_session, "reservations.number.separator", "*")
    with pytest.raises(ValidationError):
        await numbers.load_config()
    await _set_setting_raw(db_session, "reservations.number.separator", "-")

    await _set_setting_raw(db_session, "reservations.number.padding", "0")
    with pytest.raises(ValidationError):
        await numbers.load_config()
    await _set_setting_raw(db_session, "reservations.number.padding", "8")

    cfg = ReservationNumberConfig(prefix="RSV", separator="-", padding=8)
    assert numbers.format(12, config=cfg) == "RSV-00000012"

    item = ReservationItemInput(dress_id=uuid4(), notes="  x  ")
    assert item.notes == "x"
    item2 = ReservationItemInput(dress_id=uuid4(), notes="   ")
    assert item2.notes is None
    create = ReservationCreateRequest(
        customer_id=uuid4(),
        rental_start_at=utc(2026, 8, 1),
        expected_return_at=utc(2026, 8, 2),
        notes="  hi  ",
        items=[ReservationItemInput(dress_id=uuid4())],
    )
    assert create.notes == "hi"
    update = ReservationUpdateRequest(notes="  bye  ")
    assert update.notes == "bye"
    update_blank = ReservationUpdateRequest(notes="   ")
    assert update_blank.notes is None
