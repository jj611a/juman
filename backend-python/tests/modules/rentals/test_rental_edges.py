"""Extra rental edge-case coverage."""

from datetime import datetime
from uuid import uuid4

import pytest
from app.exceptions import NotFoundError, ValidationError
from app.modules.rentals.constants import InitialPaymentType, RentalSortField, RentalStatus
from app.modules.rentals.schemas.rental import RentalCreateRequest, RentalItemInput, RentalUpdateRequest
from app.modules.rentals.services.rental import RentalService
from app.modules.rentals.services.rental_number import RentalNumberConfig, RentalNumberService
from app.modules.reservations.services.reservation import ReservationService
from app.modules.settings.constants import SettingKey
from app.modules.settings.models.setting import Setting
from app.modules.settings.services.setting import SettingService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.modules.rentals.conftest import utc


@pytest.mark.asyncio
async def test_list_filters_and_customer_mismatch(
    rental_service: RentalService,
    reservation_service: ReservationService,
    dress_service,
    sample_customer,
    sample_dress,
    sample_dress_b,
    customer_service,
) -> None:
    other = await customer_service.create_customer(
        full_name="اخرى",
        phone="07001112233",
    )
    first = await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=utc(2026, 8, 1),
        expected_return_at=utc(2026, 8, 2),
        initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
        initial_payment_value=0,
        items=[{"dress_id": sample_dress.id}],
    )
    await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=utc(2026, 9, 1),
        expected_return_at=utc(2026, 9, 2),
        initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
        initial_payment_value=0,
        items=[{"dress_id": sample_dress_b.id}],
    )

    items, total = await rental_service.list(
        status="active",
        customer_id=sample_customer.id,
        sort_by=RentalSortField.RENTAL_AT,
        sort_dir="asc",
    )
    assert total == 2
    assert items[0].id == first.id

    with pytest.raises(ValidationError):
        await rental_service.list(sort_by="nope")
    with pytest.raises(ValidationError):
        await rental_service.list(sort_dir="sideways")
    with pytest.raises(ValidationError):
        await rental_service.list(status="NOPE")

    free_dress = await dress_service.create_dress(
        category_id=sample_dress.category_id,
        name_ar="فستان حجز تحويل",
        size="S",
        colour="GREEN",
        purchase_price=900,
        default_daily_rental_price=90,
        default_sale_price=1800,
    )
    draft = await reservation_service.create(
        customer_id=sample_customer.id,
        reservation_at=utc(2026, 7, 1),
        rental_start_at=utc(2026, 10, 1),
        expected_return_at=utc(2026, 10, 3),
        items=[{"dress_id": free_dress.id}],
    )
    confirmed = await reservation_service.confirm(draft.id)
    with pytest.raises(ValidationError):
        await rental_service.create(
            customer_id=other.id,
            expected_return_at=utc(2026, 10, 3),
            reservation_id=confirmed.id,
            initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
            initial_payment_value=0,
        )


@pytest.mark.asyncio
async def test_payment_and_item_validation(
    rental_service: RentalService,
    sample_customer,
    sample_dress,
    db_session: AsyncSession,
) -> None:
    with pytest.raises(ValidationError):
        await rental_service.create(
            customer_id=sample_customer.id,
            rental_at=utc(2026, 8, 1),
            expected_return_at=utc(2026, 8, 2),
            initial_payment_type="BOGUS",
            initial_payment_value=0,
            items=[{"dress_id": sample_dress.id}],
        )
    with pytest.raises(ValidationError):
        await rental_service.create(
            customer_id=sample_customer.id,
            rental_at=utc(2026, 8, 1),
            expected_return_at=utc(2026, 8, 2),
            initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
            items=[{"dress_id": sample_dress.id}],
        )
    with pytest.raises(ValidationError):
        await rental_service.create(
            customer_id=sample_customer.id,
            rental_at=utc(2026, 8, 1),
            expected_return_at=utc(2026, 8, 2),
            initial_payment_type=InitialPaymentType.PERCENTAGE,
            items=[{"dress_id": sample_dress.id}],
        )
    with pytest.raises(ValidationError):
        await rental_service.create(
            customer_id=sample_customer.id,
            rental_at=utc(2026, 8, 1),
            expected_return_at=utc(2026, 8, 2),
            initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
            initial_payment_value=0,
            items=[],
        )
    with pytest.raises(ValidationError):
        await rental_service.create(
            customer_id=sample_customer.id,
            rental_at=utc(2026, 8, 1),
            expected_return_at=utc(2026, 8, 2),
            initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
            initial_payment_value=0,
            items=[
                {"dress_id": sample_dress.id},
                {"dress_id": sample_dress.id},
            ],
        )
    with pytest.raises(ValidationError):
        await rental_service.create(
            customer_id=sample_customer.id,
            rental_at=utc(2026, 8, 1),
            expected_return_at=utc(2026, 8, 2),
            initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
            initial_payment_value=0,
            notes="ن" * 2001,
            items=[{"dress_id": sample_dress.id}],
        )
    with pytest.raises(ValidationError):
        await rental_service.create(
            customer_id=sample_customer.id,
            rental_at=datetime(2026, 8, 1),
            expected_return_at=datetime(2026, 8, 2),
            initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
            initial_payment_value=0,
            items=[{"dress_id": sample_dress.id}],
        )
    with pytest.raises(NotFoundError):
        await rental_service.create(
            customer_id=sample_customer.id,
            rental_at=utc(2026, 8, 1),
            expected_return_at=utc(2026, 8, 2),
            initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
            initial_payment_value=0,
            items=[{"dress_id": uuid4()}],
        )

    settings = SettingService(db_session)
    await settings.update_value(SettingKey.MAXIMUM_INITIAL_PAYMENT_PERCENTAGE.value, 0)
    with pytest.raises(ValidationError):
        await rental_service.create(
            customer_id=sample_customer.id,
            rental_at=utc(2026, 8, 1),
            expected_return_at=utc(2026, 8, 2),
            initial_payment_type=InitialPaymentType.PERCENTAGE,
            initial_payment_rate=1,
            items=[{"dress_id": sample_dress.id}],
        )
    await settings.update_value(SettingKey.MAXIMUM_INITIAL_PAYMENT_PERCENTAGE.value, 50)


async def _set_setting_raw(session: AsyncSession, key: str, value: str) -> None:
    result = await session.execute(
        select(Setting).where(Setting.key == key, Setting.is_deleted.is_(False))
    )
    row = result.scalar_one()
    row.value = value
    await session.flush()


@pytest.mark.asyncio
async def test_number_service_and_non_active_update(
    db_session: AsyncSession,
    rental_service: RentalService,
    sample_customer,
    sample_dress,
) -> None:
    numbers = RentalNumberService(db_session, settings=SettingService(db_session))
    config = await numbers.load_config()
    assert numbers.format(1, config=config).startswith("RENT")
    with pytest.raises(ValidationError):
        numbers.format(0, config=config)
    with pytest.raises(ValidationError):
        numbers.format(10**config.padding + 1, config=config)

    await _set_setting_raw(db_session, "rentals.number.prefix", "BAD!")
    with pytest.raises(ValidationError):
        await numbers.load_config()
    await _set_setting_raw(db_session, "rentals.number.prefix", "RENT")

    await _set_setting_raw(db_session, "rentals.number.separator", "*")
    with pytest.raises(ValidationError):
        await numbers.load_config()
    await _set_setting_raw(db_session, "rentals.number.separator", "-")

    await _set_setting_raw(db_session, "rentals.number.padding", "0")
    with pytest.raises(ValidationError):
        await numbers.load_config()
    await _set_setting_raw(db_session, "rentals.number.padding", "8")

    assert RentalNumberConfig(prefix="RENT", separator="-", padding=8)

    item = RentalItemInput(dress_id=uuid4(), notes="  x  ")
    assert item.notes == "x"
    req = RentalCreateRequest(
        customer_id=uuid4(),
        expected_return_at=utc(2026, 8, 2),
        initial_payment_type="fixed_amount",
        initial_payment_value=0,
        notes="  n  ",
        items=[item],
    )
    assert req.initial_payment_type == "FIXED_AMOUNT"
    assert req.notes == "n"
    upd = RentalUpdateRequest(notes="  u  ")
    assert upd.notes == "u"

    rental = await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=utc(2026, 8, 1),
        expected_return_at=utc(2026, 8, 2),
        initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
        initial_payment_value=0,
        items=[{"dress_id": sample_dress.id}],
    )
    await rental_service.rentals.update_fields(
        rental,
        status=RentalStatus.COMPLETED.value,
    )
    with pytest.raises(ValidationError):
        await rental_service.update(rental.id, notes="no")
