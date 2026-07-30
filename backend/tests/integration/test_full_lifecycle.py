"""
Full cross-module lifecycle integration test.

Exercises the real Juman business chain end to end through the actual service
layer (no mocking of business logic): Category -> Dress -> Customer ->
Reservation -> Rental conversion -> Return -> Inspection -> Processing ->
Settlement -> Payment; plus a parallel walk-in rental path.

This complements (does not replace) the module-level unit/API test suites,
which already cover most individual rules in isolation. This file specifically
verifies that state produced by one module is consumed correctly by the next.
"""

from datetime import timedelta

import pytest
from app.exceptions import ConflictError, ValidationError
from app.modules.audit.services.audit_log import AuditService
from app.modules.calendar.constants import CalendarBlockType
from app.modules.calendar.services.calendar import CalendarService
from app.modules.inspection.services.inspection import InspectionService
from app.modules.inventory.constants import DressStatus
from app.modules.inventory.services.dress import DressService
from app.modules.inventory.services.dress_status import DressStatusService
from app.modules.processing.constants import ProcessingStatus
from app.modules.processing.services.processing import ProcessingService
from app.modules.rentals.constants import InitialPaymentType, RentalStatus
from app.modules.rentals.services.rental import RentalService
from app.modules.reservations.constants import ReservationStatus
from app.modules.reservations.services.reservation import ReservationService
from app.modules.returns.services.return_service import ReturnService
from app.modules.settlements.constants import SettlementStatus
from app.modules.settlements.services.settlement import SettlementService
from sqlalchemy.ext.asyncio import AsyncSession
from tests.integration.conftest import set_setting, utc


@pytest.mark.asyncio
async def test_full_reservation_to_settlement_chain(
    db_session: AsyncSession,
    category_service,
    customer_service,
    dress_service: DressService,
    reservation_service: ReservationService,
    rental_service: RentalService,
    return_service: ReturnService,
    inspection_service: InspectionService,
    processing_service: ProcessingService,
    settlement_service: SettlementService,
    calendar_service: CalendarService,
) -> None:
    # --- Workflow A: inventory -> reservation ---------------------------
    category = await category_service.create_category(name_ar="sahra", name_en="Evening")

    dress = await dress_service.create_dress(
        category_id=category.id,
        name_ar="fostan ahmar",
        size="M",
        colour="RED",
        purchase_price=50_000,
        default_daily_rental_price=10_000,
        default_sale_price=200_000,
    )
    assert dress.barcode is not None

    with pytest.raises(ValidationError):
        await dress_service.create_dress(
            category_id=category.id,
            name_ar="",
            size="M",
            colour="RED",
            purchase_price=1,
            default_daily_rental_price=1,
            default_sale_price=1,
        )

    dress_status = DressStatusService(db_session)
    assert await dress_status.get_current_status(dress.id) == DressStatus.AVAILABLE.value

    customer = await customer_service.create_customer(
        full_name="Sara Ahmed",
        phone="07701234567",
        address="Baghdad - Karrada",
    )
    assert customer.full_name == "Sara Ahmed"
    assert customer.phone == "07701234567"
    assert customer.address == "Baghdad - Karrada"

    reservation_at = utc(2026, 9, 1)
    rental_start_at = utc(2026, 9, 10, 10)
    expected_return_at = utc(2026, 9, 12, 10)
    assert reservation_at != rental_start_at

    # A throwaway reservation can be confirmed then cancelled; cancellation
    # must reverse both the calendar block and the dress status.
    throwaway_start = utc(2026, 9, 20, 10)
    throwaway_end = utc(2026, 9, 21, 10)
    throwaway = await reservation_service.create(
        customer_id=customer.id,
        reservation_at=utc(2026, 9, 15),
        rental_start_at=throwaway_start,
        expected_return_at=throwaway_end,
        items=[{"dress_id": dress.id}],
    )
    throwaway = await reservation_service.confirm(throwaway.id)
    assert await dress_status.get_current_status(dress.id) == DressStatus.RESERVED.value
    cancelled = await reservation_service.cancel(throwaway.id)
    assert cancelled.status == ReservationStatus.CANCELLED.value
    cancelled_items = [i for i in cancelled.items if not i.is_deleted]
    assert all(i.calendar_block_id is None for i in cancelled_items)
    assert await dress_status.get_current_status(dress.id) == DressStatus.AVAILABLE.value
    conflicts = await calendar_service.get_conflicts(dress.id, throwaway_start, throwaway_end)
    assert conflicts == []

    draft = await reservation_service.create(
        customer_id=customer.id,
        reservation_at=reservation_at,
        rental_start_at=rental_start_at,
        expected_return_at=expected_return_at,
        items=[{"dress_id": dress.id, "reserved_daily_rental_price": 12_000}],
    )
    confirmed = await reservation_service.confirm(draft.id)
    assert confirmed.status == ReservationStatus.CONFIRMED.value
    assert await dress_status.get_current_status(dress.id) == DressStatus.RESERVED.value

    live_item = [i for i in confirmed.items if not i.is_deleted][0]
    assert live_item.calendar_block_id is not None
    block = await calendar_service.get_block(live_item.calendar_block_id)
    assert block.block_type == CalendarBlockType.RESERVATION.value

    # A second draft may be created for an overlapping window (drafts hold no
    # calendar block yet), but confirming it must be rejected once the dress
    # is already reserved for that interval.
    conflicting_draft = await reservation_service.create(
        customer_id=customer.id,
        reservation_at=reservation_at,
        rental_start_at=rental_start_at + timedelta(hours=2),
        expected_return_at=expected_return_at,
        items=[{"dress_id": dress.id}],
    )
    with pytest.raises(ConflictError):
        await reservation_service.confirm(conflicting_draft.id)

    # --- Workflow B: reservation -> rental --------------------------------
    rental = await rental_service.create(
        customer_id=customer.id,
        expected_return_at=expected_return_at,
        reservation_id=confirmed.id,
        initial_payment_type=InitialPaymentType.PERCENTAGE,
        initial_payment_rate=20,
    )
    assert rental.status == RentalStatus.ACTIVE.value
    assert rental.reservation_id == confirmed.id
    rental_item = [i for i in rental.items if not i.is_deleted][0]
    assert rental_item.agreed_daily_rental_price == 12_000  # frozen reservation price

    reservation_after = await reservation_service.get(confirmed.id)
    assert reservation_after.status == ReservationStatus.CONVERTED_TO_RENTAL.value

    # Converting the same reservation twice must be rejected.
    with pytest.raises(ValidationError):
        await rental_service.create(
            customer_id=customer.id,
            expected_return_at=expected_return_at,
            reservation_id=confirmed.id,
            initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
            initial_payment_value=0,
        )

    assert await dress_status.get_current_status(dress.id) == DressStatus.RENTED.value

    # Note: a rental converted from a reservation begins "at the transaction
    # time" (not the reservation's originally planned rental_start_at), so
    # expected_rental_days/estimated_total are computed from the conversion
    # moment to expected_return_at rather than from the reservation window.
    days = rental_item.expected_rental_days
    expected_total = 12_000 * days

    # Changing the dress's current default price must not affect the
    # already-agreed historical rental price (frozen pricing).
    await dress_service.update_dress(dress.id, default_daily_rental_price=99_000)
    refreshed_rental = await rental_service.get(rental.id)
    refreshed_item = [i for i in refreshed_rental.items if not i.is_deleted][0]
    assert refreshed_item.agreed_daily_rental_price == 12_000
    assert refreshed_rental.estimated_total == expected_total  # unaffected by price change

    initial_expected = round(expected_total * 0.20)
    assert refreshed_rental.initial_payment_value == initial_expected

    # --- Workflow C: walk-in rental (no reservation) ----------------------
    dress2 = await dress_service.create_dress(
        category_id=category.id,
        name_ar="fostan azraq",
        size="L",
        colour="BLUE",
        purchase_price=40_000,
        default_daily_rental_price=8_000,
        default_sale_price=150_000,
    )
    walk_in = await rental_service.create(
        customer_id=customer.id,
        rental_at=utc(2026, 9, 10, 9),
        expected_return_at=utc(2026, 9, 11, 9),
        initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
        initial_payment_value=0,
        items=[{"dress_id": dress2.id}],
    )
    assert walk_in.status == RentalStatus.ACTIVE.value
    assert await dress_status.get_current_status(dress2.id) == DressStatus.RENTED.value

    with pytest.raises((ValidationError, ConflictError)):
        await rental_service.create(
            customer_id=customer.id,
            rental_at=utc(2026, 9, 10, 9),
            expected_return_at=utc(2026, 9, 11, 9),
            initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
            initial_payment_value=0,
            items=[{"dress_id": dress2.id}, {"dress_id": dress2.id}],
        )

    with pytest.raises(ConflictError):
        await rental_service.create(
            customer_id=customer.id,
            rental_at=utc(2026, 9, 10, 9),
            expected_return_at=utc(2026, 9, 11, 9),
            initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
            initial_payment_value=0,
            items=[{"dress_id": dress2.id}],
        )

    # --- Workflow D: return -------------------------------------------
    # Return strictly before expected_return_at (Sep 12, 2026) so this is an
    # on-time return with no late penalty.
    ret = await return_service.create(rental_id=rental.id, returned_at=utc(2026, 9, 5, 10))
    rental_after_return = await rental_service.get(rental.id)
    assert rental_after_return.status == RentalStatus.RETURN_PENDING.value
    assert await dress_status.get_current_status(dress.id) == DressStatus.INSPECTION.value

    with pytest.raises((ValidationError, ConflictError)):
        await return_service.create(rental_id=rental.id)

    # --- Workflow E: inspection (MINOR_DAMAGE, requires laundry) -------
    insp = await inspection_service.create(return_id=ret.id)
    insp_item = [i for i in insp.items if not i.is_deleted][0]
    completed_insp = await inspection_service.update(
        insp.id,
        items=[
            {
                "id": insp_item.id,
                "condition": "MINOR_DAMAGE",
                "repair_penalty_amount": 5_000,
                "requires_laundry": True,
            }
        ],
        complete=True,
    )
    completed_item = [i for i in completed_insp.items if not i.is_deleted][0]
    assert completed_item.repair_penalty_amount == 5_000
    assert await dress_status.get_current_status(dress.id) == DressStatus.PROCESSING.value

    with pytest.raises((ValidationError, ConflictError)):
        await inspection_service.create(return_id=ret.id)

    # --- Workflow F: processing -----------------------------------------
    await set_setting(db_session, "mandatory_processing_days", "0")
    batch = await processing_service.create(inspection_item_ids=[completed_item.id])
    assert batch.status == ProcessingStatus.PENDING.value

    with pytest.raises(ConflictError):
        await processing_service.create(inspection_item_ids=[completed_item.id])

    started = await processing_service.start(batch.id)
    assert started.status == ProcessingStatus.IN_PROCESS.value
    assert started.items[0].calendar_block_id is not None

    completed_batch = await processing_service.complete(started.id)
    assert completed_batch.status == ProcessingStatus.COMPLETED.value
    # Dress becomes AVAILABLE only after processing truly completes.
    assert await dress_status.get_current_status(dress.id) == DressStatus.AVAILABLE.value

    with pytest.raises(ValidationError):
        await processing_service.complete(completed_batch.id)  # already COMPLETED

    # --- Workflow G: rental financial settlement -------------------------
    settlement = await settlement_service.create(rental_id=rental.id)
    assert settlement.status in {
        SettlementStatus.OPEN.value,
        SettlementStatus.PARTIALLY_PAID.value,
    }
    assert settlement.rental_charge_amount == expected_total  # frozen agreed price * days
    assert settlement.late_penalty_amount == 0  # returned before expected_return_at
    assert settlement.minor_damage_penalty_amount == 5_000
    assert settlement.initial_payment_credit == initial_expected

    expected_due = (
        settlement.rental_charge_amount
        + settlement.late_penalty_amount
        + settlement.minor_damage_penalty_amount
        - settlement.initial_payment_credit
    )
    assert settlement.total_due == expected_due
    assert settlement.remaining_balance == expected_due

    with pytest.raises(ConflictError):
        await settlement_service.create(rental_id=rental.id)  # duplicate settlement rejected

    partial = await settlement_service.add_payment(
        settlement.id,
        amount=1_000,
        method="CASH",
    )
    assert partial.total_paid == 1_000
    assert partial.status == SettlementStatus.PARTIALLY_PAID.value
    assert partial.remaining_balance == expected_due - 1_000

    with pytest.raises(ValidationError):
        await settlement_service.add_payment(
            settlement.id,
            amount=expected_due,  # would overpay beyond remaining balance
            method="CASH",
        )

    final = await settlement_service.add_payment(
        settlement.id,
        amount=partial.remaining_balance,
        method="CASH",
    )
    assert final.status == SettlementStatus.PAID.value
    assert final.remaining_balance == 0

    # Financial completion is independent from operational/processing state:
    # the dress was already AVAILABLE before the settlement was even fully
    # paid, and paying off the settlement must not change dress/rental status.
    assert await dress_status.get_current_status(dress.id) == DressStatus.AVAILABLE.value
    rental_final = await rental_service.get(rental.id)
    assert rental_final.status == RentalStatus.RETURN_PENDING.value

    # --- Workflow H: audit integration -----------------------------------
    audit = AuditService(db_session)
    for module, entity_id in (
        ("categories", category.id),
        ("customers", customer.id),
        ("reservations", confirmed.id),
        ("rentals", rental.id),
        ("returns", ret.id),
        ("inspection", insp.id),
        ("processing", batch.id),
        ("settlement", settlement.id),  # settlements module logs audit under "settlement"
    ):
        logs, total = await audit.list_logs(module=module, entity_id=str(entity_id))
        assert total > 0, f"expected audit rows for {module}:{entity_id}"
        for row in logs:
            assert row.entity_type
            assert row.action
            assert row.created_at is not None
            payload = f"{row.old_values} {row.new_values}"
            assert "password" not in payload.lower()
            assert "token" not in payload.lower()
