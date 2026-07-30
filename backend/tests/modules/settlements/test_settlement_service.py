"""SettlementService unit tests."""

from datetime import timedelta
from uuid import uuid4

import pytest
from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.settlements.constants import SettlementStatus
from app.modules.settlements.services.settlement import SettlementService
from tests.modules.settlements.conftest import build_ready_rental, utc


def test_late_days_math() -> None:
    expected = utc(2026, 8, 1, 10)
    assert SettlementService.late_days(expected, expected) == 0
    assert SettlementService.late_days(expected - timedelta(hours=1), expected) == 0
    assert SettlementService.late_days(expected + timedelta(seconds=1), expected) == 1
    assert SettlementService.late_days(expected + timedelta(days=2), expected) == 2
    assert (
        SettlementService.late_days(expected + timedelta(days=2, seconds=1), expected) == 3
    )


@pytest.mark.asyncio
async def test_create_ontime_and_payments(
    settlement_service: SettlementService,
    rental_service,
    return_service,
    inspection_service,
    sample_customer,
    sample_dress,
    db_session,
) -> None:
    rental_at = utc(2026, 8, 1, 10)
    expected = utc(2026, 8, 3, 10)
    rental = await build_ready_rental(
        rental_service=rental_service,
        return_service=return_service,
        inspection_service=inspection_service,
        customer=sample_customer,
        dresses=[sample_dress],
        rental_at=rental_at,
        expected_return_at=expected,
        returned_at=expected,
        initial_payment_value=50_000,
    )
    # estimated = 100_000 * 2 days = 200_000; credit 50_000 → due 150_000
    stl = await settlement_service.create(rental_id=rental.id)
    assert stl.status == SettlementStatus.OPEN.value
    assert stl.settlement_number.startswith("STL")
    assert stl.late_penalty_amount == 0
    assert stl.rental_charge_amount == rental.estimated_total
    assert stl.initial_payment_credit == 50_000
    assert stl.remaining_balance == rental.estimated_total - 50_000

    with pytest.raises(ConflictError):
        await settlement_service.create(rental_id=rental.id)

    partial = await settlement_service.add_payment(
        stl.id,
        amount=50_000,
        method="CASH",
    )
    assert partial.status == SettlementStatus.PARTIALLY_PAID.value
    assert partial.total_paid == 50_000

    with pytest.raises(ValidationError):
        await settlement_service.add_payment(
            stl.id,
            amount=partial.remaining_balance + 1,
            method="CASH",
        )

    paid = await settlement_service.add_payment(
        stl.id,
        amount=partial.remaining_balance,
        method="CARD",
    )
    assert paid.status == SettlementStatus.PAID.value
    assert paid.remaining_balance == 0
    assert paid.settled_at is not None

    with pytest.raises(ValidationError):
        await settlement_service.add_payment(stl.id, amount=1, method="CASH")

    audit = AuditService(db_session)
    logs, _ = await audit.list_logs(module="settlement", entity_id=str(stl.id))
    actions = {row.action for row in logs}
    assert AuditAction.CREATE.value in actions
    assert AuditAction.COMPLETE.value in actions


@pytest.mark.asyncio
async def test_late_multi_dress_and_damage(
    settlement_service: SettlementService,
    rental_service,
    return_service,
    inspection_service,
    dress_service,
    sample_customer,
    sample_category,
) -> None:
    d1 = await dress_service.create_dress(
        category_id=sample_category.id,
        name_ar="أ",
        size="M",
        colour="BLACK",
        purchase_price=900,
        default_daily_rental_price=100_000,
        default_sale_price=1800,
    )
    d2 = await dress_service.create_dress(
        category_id=sample_category.id,
        name_ar="ب",
        size="L",
        colour="WHITE",
        purchase_price=900,
        default_daily_rental_price=50_000,
        default_sale_price=1800,
    )
    rental_at = utc(2026, 9, 1, 10)
    expected = utc(2026, 9, 2, 10)
    returned = expected + timedelta(days=2)
    rental = await build_ready_rental(
        rental_service=rental_service,
        return_service=return_service,
        inspection_service=inspection_service,
        customer=sample_customer,
        dresses=[d1, d2],
        rental_at=rental_at,
        expected_return_at=expected,
        returned_at=returned,
        initial_payment_value=0,
        inspection_items=[
            {
                "dress_id": d1.id,
                "condition": "MINOR_DAMAGE",
                "repair_penalty_amount": 25_000,
                "requires_laundry": True,
            },
            {
                "dress_id": d2.id,
                "condition": "MAJOR_DAMAGE",
                "send_to_ruined": True,
                "requires_laundry": False,
            },
        ],
    )
    stl = await settlement_service.create(rental_id=rental.id)
    # late: (100k+50k)*2 = 300_000; damage only minor 25_000; major excluded
    assert stl.late_penalty_amount == 300_000
    assert stl.minor_damage_penalty_amount == 25_000
    assert stl.remaining_balance == (
        stl.rental_charge_amount + 300_000 + 25_000
    )


@pytest.mark.asyncio
async def test_adjustments_and_guards(
    settlement_service: SettlementService,
    rental_service,
    return_service,
    inspection_service,
    sample_customer,
    sample_dress,
) -> None:
    rental = await build_ready_rental(
        rental_service=rental_service,
        return_service=return_service,
        inspection_service=inspection_service,
        customer=sample_customer,
        dresses=[sample_dress],
        rental_at=utc(2026, 10, 1),
        expected_return_at=utc(2026, 10, 2),
        returned_at=utc(2026, 10, 2),
        initial_payment_value=0,
    )
    stl = await settlement_service.create(rental_id=rental.id)
    base_remaining = stl.remaining_balance
    with pytest.raises(ValidationError):
        await settlement_service.add_adjustment(stl.id, amount=0, reason="سبب كاف")
    with pytest.raises(ValidationError):
        await settlement_service.add_adjustment(stl.id, amount=-10, reason="اب")

    # discount that would go negative
    with pytest.raises(ValidationError):
        await settlement_service.add_adjustment(
            stl.id,
            amount=-(base_remaining + 1),
            reason="خصم مفرط",
        )

    adjusted = await settlement_service.add_adjustment(
        stl.id,
        amount=5_000,
        reason="رسوم إضافية",
    )
    assert adjusted.manual_adjustment_amount == 5_000
    assert adjusted.remaining_balance == base_remaining + 5_000

    discounted = await settlement_service.add_adjustment(
        adjusted.id,
        amount=-5_000,
        reason="إلغاء الرسوم",
    )
    assert discounted.manual_adjustment_amount == 0

    with pytest.raises(NotFoundError):
        await settlement_service.get(uuid4())
    with pytest.raises(ValidationError):
        await settlement_service.list(status="NOPE")
