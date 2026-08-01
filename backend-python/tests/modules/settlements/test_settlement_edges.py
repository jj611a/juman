"""Additional settlement edge-case coverage."""

from datetime import timedelta
from uuid import uuid4

import pytest
from app.exceptions import NotFoundError, ValidationError
from app.modules.settings.services.setting import SettingService
from app.modules.settlements.constants import SettlementStatus
from app.modules.settlements.models.adjustment import RentalSettlementAdjustment
from app.modules.settlements.models.charge import RentalSettlementCharge
from app.modules.settlements.models.payment import RentalSettlementPayment
from app.modules.settlements.repositories.settlement import (
    RentalSettlementAdjustmentRepository,
    RentalSettlementChargeRepository,
    RentalSettlementPaymentRepository,
    RentalSettlementRepository,
)
from app.modules.settlements.schemas.settlement import (
    SettlementAdjustmentRequest,
    SettlementCreateRequest,
    SettlementPaymentRequest,
)
from app.modules.settlements.services.settlement import SettlementService, _normalize_notes
from app.modules.settlements.services.settlement_number import (
    SettlementNumberConfig,
    SettlementNumberService,
)
from pydantic import ValidationError as PydanticValidationError
from tests.modules.settlements.conftest import build_ready_rental, utc


@pytest.mark.asyncio
async def test_create_eligibility_and_full_credit(
    settlement_service: SettlementService,
    rental_service,
    return_service,
    inspection_service,
    dress_service,
    sample_customer,
    sample_dress,
    sample_category,
) -> None:
    rental_at = utc(2026, 12, 1)
    expected = utc(2026, 12, 2)
    rental = await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=rental_at,
        expected_return_at=expected,
        initial_payment_type="FIXED_AMOUNT",
        initial_payment_value=0,
        items=[{"dress_id": sample_dress.id}],
    )
    with pytest.raises(ValidationError):
        await settlement_service.create(rental_id=rental.id)

    ret = await return_service.create(rental_id=rental.id, returned_at=expected)
    with pytest.raises(ValidationError):
        await settlement_service.create(rental_id=rental.id)

    await inspection_service.create(return_id=ret.id)
    # inspection not completed yet
    with pytest.raises(ValidationError):
        await settlement_service.create(rental_id=rental.id)

    with pytest.raises(NotFoundError):
        await settlement_service.create(rental_id=uuid4())

    other = await dress_service.create_dress(
        category_id=sample_category.id,
        name_ar="فستان ائتمان",
        size="S",
        colour="BLUE",
        purchase_price=1000,
        default_daily_rental_price=100_000,
        default_sale_price=2000,
    )
    # Full credit → PAID at create
    ready = await build_ready_rental(
        rental_service=rental_service,
        return_service=return_service,
        inspection_service=inspection_service,
        customer=sample_customer,
        dresses=[other],
        rental_at=utc(2026, 12, 10),
        expected_return_at=utc(2026, 12, 11),
        returned_at=utc(2026, 12, 11),
        initial_payment_value=100_000,  # 1 day * 100_000
    )
    paid = await settlement_service.create(
        rental_id=ready.id,
        notes="تسوية مكتملة بالدفعة الأولية",
    )
    assert paid.status == SettlementStatus.PAID.value
    assert paid.remaining_balance == 0
    assert paid.settled_at is not None
    assert paid.notes is not None


@pytest.mark.asyncio
async def test_frozen_price_and_payment_guards(
    settlement_service: SettlementService,
    rental_service,
    return_service,
    inspection_service,
    dress_service,
    sample_customer,
    sample_dress,
    db_session,
) -> None:
    rental = await build_ready_rental(
        rental_service=rental_service,
        return_service=return_service,
        inspection_service=inspection_service,
        customer=sample_customer,
        dresses=[sample_dress],
        rental_at=utc(2027, 1, 1),
        expected_return_at=utc(2027, 1, 3),
        returned_at=utc(2027, 1, 3) + timedelta(seconds=1),
        initial_payment_value=0,
    )
    # Change dress default after handover — settlement must use frozen agreed price
    await dress_service.update_dress(
        sample_dress.id,
        default_daily_rental_price=999_999,
    )
    stl = await settlement_service.create(rental_id=rental.id)
    assert stl.late_penalty_amount == 100_000  # 1 late day × frozen 100_000
    assert stl.rental_charge_amount == 200_000

    with pytest.raises(NotFoundError):
        await settlement_service.add_payment(uuid4(), amount=1, method="CASH")
    with pytest.raises(ValidationError):
        await settlement_service.add_payment(stl.id, amount=0, method="CASH")
    with pytest.raises(ValidationError):
        await settlement_service.add_payment(
            stl.id,
            amount=10,
            method="CASH",
            reference_number="x" * 101,
        )

    # Concurrent-style: first takes remaining, second overpays
    first = await settlement_service.add_payment(
        stl.id,
        amount=stl.remaining_balance,
        method="BANK_TRANSFER",
        reference_number=" REF-1 ",
        notes="  ",
        received_at=utc(2027, 1, 4),
    )
    assert first.status == SettlementStatus.PAID.value
    with pytest.raises(ValidationError):
        await settlement_service.add_payment(stl.id, amount=1, method="OTHER")
    with pytest.raises(ValidationError):
        await settlement_service.add_adjustment(stl.id, amount=1, reason="بعد السداد")

    # VOIDED status guard
    stl.status = SettlementStatus.VOIDED.value
    await db_session.flush()
    with pytest.raises(ValidationError):
        await settlement_service.add_payment(stl.id, amount=1, method="CASH")
    with pytest.raises(ValidationError):
        await settlement_service.add_adjustment(stl.id, amount=1, reason="ملغاة")


@pytest.mark.asyncio
async def test_normalize_notes_adjustment_long_reason_and_repos(
    settlement_service: SettlementService,
    rental_service,
    return_service,
    inspection_service,
    sample_customer,
    sample_dress,
    db_session,
) -> None:
    with pytest.raises(ValidationError):
        _normalize_notes("x" * 2001, max_length=2000, field="notes")
    assert _normalize_notes(None, max_length=10, field="notes") is None
    assert _normalize_notes("  hi  ", max_length=10, field="notes") == "hi"

    rental = await build_ready_rental(
        rental_service=rental_service,
        return_service=return_service,
        inspection_service=inspection_service,
        customer=sample_customer,
        dresses=[sample_dress],
        rental_at=utc(2027, 2, 1),
        expected_return_at=utc(2027, 2, 2),
        returned_at=utc(2027, 2, 2),
        initial_payment_value=0,
    )
    stl = await settlement_service.create(rental_id=rental.id)
    with pytest.raises(ValidationError):
        await settlement_service.add_adjustment(
            stl.id,
            amount=1,
            reason="س" * 501,
        )
    with pytest.raises(NotFoundError):
        await settlement_service.add_adjustment(uuid4(), amount=1, reason="سبب كافٍ")
    with pytest.raises(ValidationError):
        await settlement_service.list(sort_dir="sideways")

    # Partial pay then discount remaining → still PARTIALLY until final
    partial = await settlement_service.add_payment(stl.id, amount=10_000, method="CASH")
    assert partial.status == SettlementStatus.PARTIALLY_PAID.value
    discounted = await settlement_service.add_adjustment(
        stl.id,
        amount=-5_000,
        reason="خصم جزئي",
    )
    assert discounted.status == SettlementStatus.PARTIALLY_PAID.value

    charges = RentalSettlementChargeRepository(db_session)
    payments = RentalSettlementPaymentRepository(db_session)
    adjustments = RentalSettlementAdjustmentRepository(db_session)
    settlements = RentalSettlementRepository(db_session)
    assert await charges.list_for_settlement(stl.id)
    assert await payments.list_for_settlement(stl.id)
    assert await adjustments.list_for_settlement(stl.id)
    found = await settlements.get_by_settlement_number(
        stl.settlement_number,
        exclude_id=uuid4(),
        include_deleted=False,
    )
    assert found is not None
    assert "STL" in repr(stl)
    assert repr(
        RentalSettlementCharge(
            settlement_id=stl.id,
            charge_type="RENTAL",
            amount=1,
            description="t",
        )
    )
    assert repr(
        RentalSettlementPayment(
            settlement_id=stl.id,
            amount=1,
            payment_method="CASH",
            received_at=utc(2027, 2, 2),
        )
    )
    assert repr(
        RentalSettlementAdjustment(
            settlement_id=stl.id,
            amount=1,
            reason="سبب",
        )
    )


@pytest.mark.asyncio
async def test_number_overflow_and_collision(
    db_session,
    settlement_service: SettlementService,
    rental_service,
    return_service,
    inspection_service,
    sample_customer,
    sample_dress,
) -> None:
    numbers = SettlementNumberService(db_session, settings=SettingService(db_session))
    config = SettlementNumberConfig(prefix="STL", separator="-", padding=1)
    with pytest.raises(ValidationError):
        numbers.format(10, config=config)

    rental = await build_ready_rental(
        rental_service=rental_service,
        return_service=return_service,
        inspection_service=inspection_service,
        customer=sample_customer,
        dresses=[sample_dress],
        rental_at=utc(2027, 3, 1),
        expected_return_at=utc(2027, 3, 2),
        returned_at=utc(2027, 3, 2),
        initial_payment_value=0,
    )
    stl = await settlement_service.create(rental_id=rental.id)
    assert await numbers.exists(stl.settlement_number)

    # Force collision path: counter behind an existing number
    from app.modules.inventory.repositories.barcode_counter import BarcodeCounterRepository

    counter = await BarcodeCounterRepository(db_session).get_or_create_for_update("STL")
    counter.last_value = 0
    await db_session.flush()
    nxt = await numbers.generate_next()
    assert nxt != stl.settlement_number
    assert nxt.startswith("STL-")


def test_schema_validators() -> None:
    assert SettlementCreateRequest(rental_id=uuid4(), notes="  ").notes is None
    assert SettlementCreateRequest(rental_id=uuid4(), notes=" hi ").notes == "hi"
    pay = SettlementPaymentRequest(
        amount=1,
        payment_method="CASH",
        reference_number="  ",
        notes=" n ",
    )
    assert pay.reference_number is None
    assert pay.notes == "n"
    adj = SettlementAdjustmentRequest(amount=-5, reason="  خصم  ")
    assert adj.reason == "خصم"
    with pytest.raises(PydanticValidationError):
        SettlementAdjustmentRequest(amount=0, reason="سبب كاف")
