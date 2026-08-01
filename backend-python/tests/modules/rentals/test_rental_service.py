"""RentalService unit tests."""

from uuid import uuid4

import pytest
from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.calendar.constants import CalendarBlockType
from app.modules.calendar.services.calendar import CalendarService
from app.modules.inventory.constants import DressStatus
from app.modules.inventory.services.dress_status import DressStatusService
from app.modules.rentals.constants import InitialPaymentType, RentalStatus
from app.modules.rentals.services.rental import RentalService
from app.modules.reservations.constants import ReservationStatus
from app.modules.reservations.services.reservation import ReservationService
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from sqlalchemy.ext.asyncio import AsyncSession
from tests.modules.rentals.conftest import utc


def _remaining(rental) -> int:
    return int(rental.estimated_total) - int(rental.initial_payment_value)


@pytest.mark.asyncio
async def test_walk_in_fixed_payment_calendar_and_status(
    rental_service: RentalService,
    sample_customer,
    sample_dress,
    sample_dress_b,
    db_session: AsyncSession,
) -> None:
    rental = await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=utc(2026, 8, 1, 10),
        expected_return_at=utc(2026, 8, 3, 10),
        initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
        initial_payment_value=150,
        notes="مباشر",
        items=[
            {"dress_id": sample_dress.id},
            {"dress_id": sample_dress_b.id, "agreed_daily_rental_price": 250},
        ],
        actor_username="admin",
    )
    assert rental.status == RentalStatus.ACTIVE.value
    assert rental.rental_number.startswith("RENT")
    # 2 days x (100 + 250) = 700; payment 150 -> remaining 550
    assert rental.estimated_total == 700
    assert rental.initial_payment_value == 150
    assert _remaining(rental) == 550
    assert rental.initial_payment_rate is None
    live = [i for i in rental.items if not i.is_deleted]
    assert len(live) == 2
    assert all(i.calendar_block_id is not None for i in live)
    assert all(i.expected_rental_days == 2 for i in live)

    status_svc = DressStatusService(db_session)
    assert await status_svc.get_current_status(sample_dress.id) == DressStatus.RENTED.value
    assert await status_svc.get_current_status(sample_dress_b.id) == DressStatus.RENTED.value

    cal = CalendarService(db_session)
    assert not await cal.is_available(
        sample_dress.id,
        utc(2026, 8, 1, 10),
        utc(2026, 8, 3, 10),
    )
    blocks = await cal.get_conflicts(
        sample_dress.id,
        utc(2026, 8, 1, 10),
        utc(2026, 8, 3, 10),
    )
    assert blocks[0].block_type == CalendarBlockType.RENTAL.value

    audit = AuditService(db_session)
    logs, _ = await audit.list_logs(module="rentals", entity_id=str(rental.id))
    assert any(row.action == AuditAction.CREATE.value for row in logs)


@pytest.mark.asyncio
async def test_walk_in_percentage_payment(
    rental_service: RentalService,
    sample_customer,
    sample_dress,
) -> None:
    # 3 days x 100 = 300; 50% -> 150
    rental = await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=utc(2026, 9, 1),
        expected_return_at=utc(2026, 9, 4),
        initial_payment_type="PERCENTAGE",
        initial_payment_rate=50,
        items=[{"dress_id": sample_dress.id}],
    )
    assert rental.estimated_total == 300
    assert rental.initial_payment_type == InitialPaymentType.PERCENTAGE.value
    assert rental.initial_payment_rate == 50
    assert rental.initial_payment_value == 150
    assert _remaining(rental) == 150


@pytest.mark.asyncio
async def test_from_confirmed_reservation(
    rental_service: RentalService,
    reservation_service: ReservationService,
    sample_customer,
    sample_dress,
    db_session: AsyncSession,
) -> None:
    draft = await reservation_service.create(
        customer_id=sample_customer.id,
        reservation_at=utc(2026, 7, 1),
        rental_start_at=utc(2026, 10, 10, 10),
        expected_return_at=utc(2026, 10, 12, 10),
        items=[{"dress_id": sample_dress.id, "reserved_daily_rental_price": 180}],
    )
    confirmed = await reservation_service.confirm(draft.id)
    old_block = [i for i in confirmed.items if not i.is_deleted][0].calendar_block_id
    assert old_block is not None

    rental = await rental_service.create(
        customer_id=sample_customer.id,
        expected_return_at=utc(2026, 10, 12, 10),
        reservation_id=confirmed.id,
        initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
        initial_payment_value=0,
    )
    assert rental.status == RentalStatus.ACTIVE.value
    assert rental.reservation_id == confirmed.id
    live = [i for i in rental.items if not i.is_deleted]
    assert live[0].agreed_daily_rental_price == 180
    assert live[0].calendar_block_id is not None
    assert live[0].calendar_block_id != old_block

    reservation = await reservation_service.get(confirmed.id)
    assert reservation.status == ReservationStatus.CONVERTED_TO_RENTAL.value
    res_items = [i for i in reservation.items if not i.is_deleted]
    assert all(i.calendar_block_id is None for i in res_items)

    status_svc = DressStatusService(db_session)
    assert await status_svc.get_current_status(sample_dress.id) == DressStatus.RENTED.value

    audit = AuditService(db_session)
    logs, _ = await audit.list_logs(module="reservations", entity_id=str(confirmed.id))
    assert any(row.action == AuditAction.CONVERT.value for row in logs)


@pytest.mark.asyncio
async def test_reject_unconfirmed_conflict_and_pct_over_max(
    rental_service: RentalService,
    reservation_service: ReservationService,
    sample_customer,
    sample_dress,
    db_session: AsyncSession,
) -> None:
    draft = await reservation_service.create(
        customer_id=sample_customer.id,
        reservation_at=utc(2026, 7, 1),
        rental_start_at=utc(2026, 11, 1),
        expected_return_at=utc(2026, 11, 3),
        items=[{"dress_id": sample_dress.id}],
    )
    with pytest.raises(ValidationError):
        await rental_service.create(
            customer_id=sample_customer.id,
            expected_return_at=utc(2026, 11, 3),
            reservation_id=draft.id,
            initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
            initial_payment_value=0,
        )

    first = await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=utc(2026, 11, 1),
        expected_return_at=utc(2026, 11, 3),
        initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
        initial_payment_value=0,
        items=[{"dress_id": sample_dress.id}],
    )
    assert first.status == RentalStatus.ACTIVE.value

    with pytest.raises(ConflictError):
        await rental_service.create(
            customer_id=sample_customer.id,
            rental_at=utc(2026, 11, 2),
            expected_return_at=utc(2026, 11, 4),
            initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
            initial_payment_value=0,
            items=[{"dress_id": sample_dress.id}],
        )

    settings = SettingService(db_session)
    max_pct = await settings.get_int(SettingKey.MAXIMUM_INITIAL_PAYMENT_PERCENTAGE.value)
    with pytest.raises(ValidationError):
        await rental_service.create(
            customer_id=sample_customer.id,
            rental_at=utc(2026, 12, 1),
            expected_return_at=utc(2026, 12, 2),
            initial_payment_type=InitialPaymentType.PERCENTAGE,
            initial_payment_rate=max_pct + 1,
            items=[{"dress_id": sample_dress.id}],
        )


@pytest.mark.asyncio
async def test_cancel_always_rejected_no_side_effects(
    rental_service: RentalService,
    sample_customer,
    sample_dress,
    db_session: AsyncSession,
) -> None:
    rental = await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=utc(2026, 8, 1),
        expected_return_at=utc(2026, 8, 2),
        initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
        initial_payment_value=50,
        items=[{"dress_id": sample_dress.id}],
    )
    with pytest.raises(ValidationError) as exc:
        await rental_service.cancel(rental.id, actor_username="admin")
    assert "rental_cancel_requires_return" in str(exc.value.details)
    assert "لا يمكن إلغاء عملية التأجير بعد تسليم الفستان" in str(exc.value)

    refreshed = await rental_service.get(rental.id)
    assert refreshed.status == RentalStatus.ACTIVE.value
    status_svc = DressStatusService(db_session)
    assert await status_svc.get_current_status(sample_dress.id) == DressStatus.RENTED.value
    cal = CalendarService(db_session)
    assert not await cal.is_available(
        sample_dress.id,
        utc(2026, 8, 1),
        utc(2026, 8, 2),
    )

    audit = AuditService(db_session)
    logs, _ = await audit.list_logs(module="rentals", entity_id=str(rental.id))
    assert any(row.action == AuditAction.CANCEL.value for row in logs)


@pytest.mark.asyncio
async def test_update_notes_and_validation_edges(
    rental_service: RentalService,
    sample_customer,
    sample_dress,
) -> None:
    rental = await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=utc(2026, 8, 1),
        expected_return_at=utc(2026, 8, 2),
        initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
        initial_payment_value=0,
        items=[{"dress_id": sample_dress.id}],
    )
    updated = await rental_service.update(rental.id, notes="ملاحظة")
    assert updated.notes == "ملاحظة"
    cleared = await rental_service.update(rental.id, clear_notes=True)
    assert cleared.notes is None

    with pytest.raises(ValidationError):
        await rental_service.update(rental.id)
    with pytest.raises(NotFoundError):
        await rental_service.get(uuid4())
    with pytest.raises(ValidationError):
        await rental_service.create(
            customer_id=sample_customer.id,
            rental_at=utc(2026, 8, 2),
            expected_return_at=utc(2026, 8, 1),
            initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
            initial_payment_value=0,
            items=[{"dress_id": sample_dress.id}],
        )
    with pytest.raises(ValidationError):
        await rental_service.create(
            customer_id=sample_customer.id,
            rental_at=utc(2026, 12, 1),
            expected_return_at=utc(2026, 12, 2),
            initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
            initial_payment_value=999999,
            items=[{"dress_id": sample_dress.id}],
        )
    with pytest.raises(NotFoundError):
        await rental_service.create(
            customer_id=uuid4(),
            rental_at=utc(2026, 12, 10),
            expected_return_at=utc(2026, 12, 11),
            initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
            initial_payment_value=0,
            items=[{"dress_id": sample_dress.id}],
        )
