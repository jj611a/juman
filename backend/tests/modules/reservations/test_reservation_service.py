"""ReservationService unit tests."""

from uuid import uuid4

import pytest
from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.calendar.services.calendar import CalendarService
from app.modules.inventory.constants import DressStatus
from app.modules.inventory.services.dress_status import DressStatusService
from app.modules.reservations.constants import ReservationStatus
from app.modules.reservations.services.reservation import ReservationService
from sqlalchemy.ext.asyncio import AsyncSession
from tests.modules.reservations.conftest import utc


@pytest.mark.asyncio
async def test_create_draft_and_confirm_multi_dress(
    reservation_service: ReservationService,
    sample_customer,
    sample_dress,
    sample_dress_b,
    db_session: AsyncSession,
) -> None:
    draft = await reservation_service.create(
        customer_id=sample_customer.id,
        reservation_at=utc(2026, 7, 1),
        rental_start_at=utc(2026, 8, 10, 10),
        expected_return_at=utc(2026, 8, 12, 10),
        items=[
            {"dress_id": sample_dress.id},
            {"dress_id": sample_dress_b.id, "reserved_daily_rental_price": 250},
        ],
        notes="مسودة",
        actor_username="admin",
    )
    assert draft.status == ReservationStatus.DRAFT.value
    assert draft.reservation_number.startswith("RSV")
    assert len([i for i in draft.items if not i.is_deleted]) == 2
    prices = {
        i.dress_id: i.reserved_daily_rental_price
        for i in draft.items
        if not i.is_deleted
    }
    assert prices[sample_dress.id] == 150
    assert prices[sample_dress_b.id] == 250

    confirmed = await reservation_service.confirm(draft.id)
    assert confirmed.status == ReservationStatus.CONFIRMED.value
    live = [i for i in confirmed.items if not i.is_deleted]
    assert all(i.calendar_block_id is not None for i in live)

    status_svc = DressStatusService(db_session)
    assert await status_svc.get_current_status(sample_dress.id) == DressStatus.RESERVED.value
    assert await status_svc.get_current_status(sample_dress_b.id) == DressStatus.RESERVED.value

    cal = CalendarService(db_session)
    assert not await cal.is_available(
        sample_dress.id,
        utc(2026, 8, 10, 10),
        utc(2026, 8, 12, 10),
    )

    audit = AuditService(db_session)
    logs, _ = await audit.list_logs(module="reservations", entity_id=str(draft.id))
    actions = {row.action for row in logs}
    assert AuditAction.CREATE.value in actions
    assert AuditAction.CONFIRM.value in actions


@pytest.mark.asyncio
async def test_confirm_conflict_and_cancel(
    reservation_service: ReservationService,
    sample_customer,
    sample_dress,
    db_session: AsyncSession,
) -> None:
    first = await reservation_service.create(
        customer_id=sample_customer.id,
        reservation_at=utc(2026, 7, 1),
        rental_start_at=utc(2026, 9, 1),
        expected_return_at=utc(2026, 9, 3),
        items=[{"dress_id": sample_dress.id}],
    )
    await reservation_service.confirm(first.id)

    second = await reservation_service.create(
        customer_id=sample_customer.id,
        reservation_at=utc(2026, 7, 2),
        rental_start_at=utc(2026, 9, 2),
        expected_return_at=utc(2026, 9, 4),
        items=[{"dress_id": sample_dress.id}],
    )
    with pytest.raises(ConflictError):
        await reservation_service.confirm(second.id)

    cancelled = await reservation_service.cancel(first.id)
    assert cancelled.status == ReservationStatus.CANCELLED.value
    status_svc = DressStatusService(db_session)
    assert await status_svc.get_current_status(sample_dress.id) == DressStatus.AVAILABLE.value
    cal = CalendarService(db_session)
    assert await cal.is_available(
        sample_dress.id,
        utc(2026, 9, 1),
        utc(2026, 9, 3),
    )


@pytest.mark.asyncio
async def test_expire_and_draft_update(
    reservation_service: ReservationService,
    sample_customer,
    sample_dress,
    sample_dress_b,
    db_session: AsyncSession,
) -> None:
    draft = await reservation_service.create(
        customer_id=sample_customer.id,
        reservation_at=utc(2026, 7, 1),
        rental_start_at=utc(2026, 10, 1),
        expected_return_at=utc(2026, 10, 2),
        items=[{"dress_id": sample_dress.id}],
    )
    updated = await reservation_service.update(
        draft.id,
        notes="محدّث",
        items=[{"dress_id": sample_dress_b.id, "reserved_daily_rental_price": 300}],
        rental_start_at=utc(2026, 10, 5),
        expected_return_at=utc(2026, 10, 7),
    )
    live = [i for i in updated.items if not i.is_deleted]
    assert len(live) == 1
    assert live[0].dress_id == sample_dress_b.id
    assert updated.notes == "محدّث"

    confirmed = await reservation_service.confirm(updated.id)
    with pytest.raises(ValidationError):
        await reservation_service.update(confirmed.id, notes="لا")

    expired = await reservation_service.expire(confirmed.id)
    assert expired.status == ReservationStatus.EXPIRED.value
    status_svc = DressStatusService(db_session)
    assert await status_svc.get_current_status(sample_dress_b.id) == DressStatus.AVAILABLE.value


@pytest.mark.asyncio
async def test_validation_and_convert_stub(
    reservation_service: ReservationService,
    sample_customer,
    sample_dress,
) -> None:
    with pytest.raises(ValidationError):
        await reservation_service.create(
            customer_id=sample_customer.id,
            reservation_at=utc(2026, 8, 10),
            rental_start_at=utc(2026, 8, 1),
            expected_return_at=utc(2026, 8, 2),
            items=[{"dress_id": sample_dress.id}],
        )
    with pytest.raises(ValidationError):
        await reservation_service.create(
            customer_id=sample_customer.id,
            reservation_at=utc(2026, 7, 1),
            rental_start_at=utc(2026, 8, 2),
            expected_return_at=utc(2026, 8, 1),
            items=[{"dress_id": sample_dress.id}],
        )
    with pytest.raises(ValidationError):
        await reservation_service.create(
            customer_id=sample_customer.id,
            reservation_at=utc(2026, 7, 1),
            rental_start_at=utc(2026, 8, 1),
            expected_return_at=utc(2026, 8, 2),
            items=[],
        )
    with pytest.raises(ValidationError):
        await reservation_service.create(
            customer_id=sample_customer.id,
            reservation_at=utc(2026, 7, 1),
            rental_start_at=utc(2026, 8, 1),
            expected_return_at=utc(2026, 8, 2),
            items=[
                {"dress_id": sample_dress.id},
                {"dress_id": sample_dress.id},
            ],
        )
    with pytest.raises(NotFoundError):
        await reservation_service.create(
            customer_id=uuid4(),
            reservation_at=utc(2026, 7, 1),
            rental_start_at=utc(2026, 8, 1),
            expected_return_at=utc(2026, 8, 2),
            items=[{"dress_id": sample_dress.id}],
        )

    draft = await reservation_service.create(
        customer_id=sample_customer.id,
        reservation_at=utc(2026, 7, 1),
        rental_start_at=utc(2026, 11, 1),
        expected_return_at=utc(2026, 11, 2),
        items=[{"dress_id": sample_dress.id}],
    )
    with pytest.raises(ValidationError) as exc:
        await reservation_service.convert_to_rental(draft.id)
    assert "use_rentals_create" in str(exc.value.details)

    await reservation_service.cancel(draft.id)
    with pytest.raises(ValidationError):
        await reservation_service.expire(draft.id)
