"""SaleService unit tests."""

from uuid import uuid4

import pytest
from app.exceptions import BusinessError, ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.inventory.constants import DressStatus
from app.modules.inventory.services.dress_status import DressStatusService
from app.modules.reservations.constants import ReservationStatus
from app.modules.sales.constants import SaleOrigin, SaleStatus
from app.modules.sales.schemas.sale import SalePaymentCreateRequest
from app.modules.sales.services.sale import SaleService
from app.modules.settings.constants import SettingKey
from app.modules.settings.models.setting import Setting
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.modules.sales.conftest import (
    build_available_dress,
    build_ruined_pending_context,
    normal_item,
    payment,
    utc,
)


async def _set_bool_setting(session: AsyncSession, key: SettingKey, value: bool) -> None:
    result = await session.execute(
        select(Setting).where(Setting.key == key.value, Setting.is_deleted.is_(False))
    )
    row = result.scalar_one()
    row.value = "true" if value else "false"
    await session.flush()


@pytest.mark.asyncio
async def test_normal_sale_pricing(
    sale_service: SaleService,
    dress_service,
    sample_category,
    sample_customer,
) -> None:
    default_dress = await build_available_dress(
        dress_service=dress_service,
        sample_category=sample_category,
        name_ar="افتراضي",
        default_sale_price=2000,
    )
    lower_dress = await build_available_dress(
        dress_service=dress_service,
        sample_category=sample_category,
        name_ar="اقل",
        default_sale_price=3000,
    )
    higher_dress = await build_available_dress(
        dress_service=dress_service,
        sample_category=sample_category,
        name_ar="اعلى",
        default_sale_price=4000,
    )
    freeze_dress = await build_available_dress(
        dress_service=dress_service,
        sample_category=sample_category,
        name_ar="تجميد",
        default_sale_price=5000,
    )

    default_sale = await sale_service.create(
        origin=SaleOrigin.NORMAL_SALE,
        customer_id=sample_customer.id,
        items=[normal_item(default_dress.id)],
        payment=payment(2000),
    )
    assert default_sale.items[0].default_sale_price == 2000
    assert default_sale.items[0].actual_sale_price == 2000

    lower_sale = await sale_service.create(
        origin=SaleOrigin.NORMAL_SALE,
        items=[normal_item(lower_dress.id, actual_sale_price=2500)],
        payment=payment(2500),
    )
    assert lower_sale.items[0].actual_sale_price == 2500

    higher_sale = await sale_service.create(
        origin=SaleOrigin.NORMAL_SALE,
        items=[normal_item(higher_dress.id, actual_sale_price=4500)],
        payment=payment(4500),
    )
    assert higher_sale.items[0].actual_sale_price == 4500

    freeze_sale = await sale_service.create(
        origin=SaleOrigin.NORMAL_SALE,
        items=[normal_item(freeze_dress.id)],
        payment=payment(5000),
    )
    await dress_service.update_dress(freeze_dress.id, default_sale_price=9000)
    refreshed = await sale_service.get(freeze_sale.id)
    assert refreshed.items[0].default_sale_price == 5000
    assert refreshed.items[0].actual_sale_price == 5000


@pytest.mark.asyncio
async def test_sold_dress_cannot_resell(
    sale_service: SaleService,
    sample_dress,
    db_session: AsyncSession,
) -> None:
    await sale_service.create(
        origin=SaleOrigin.NORMAL_SALE,
        items=[normal_item(sample_dress.id)],
        payment=payment(sample_dress.default_sale_price),
    )
    status_svc = DressStatusService(db_session)
    assert await status_svc.get_current_status(sample_dress.id) == DressStatus.SOLD.value

    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.NORMAL_SALE,
            items=[normal_item(sample_dress.id)],
            payment=payment(sample_dress.default_sale_price),
        )


@pytest.mark.asyncio
async def test_future_reservation_blocks_sale(
    sale_service: SaleService,
    calendar_service,
    sample_dress,
) -> None:
    await calendar_service.create_block(
        dress_id=sample_dress.id,
        block_type="RESERVATION",
        start_at=utc(2026, 12, 1, 10),
        end_at=utc(2026, 12, 3, 10),
        reference_module="reservations",
        reference_id=uuid4(),
    )

    with pytest.raises(BusinessError) as exc:
        await sale_service.create(
            origin=SaleOrigin.NORMAL_SALE,
            items=[normal_item(sample_dress.id)],
            payment=payment(sample_dress.default_sale_price),
        )
    assert exc.value.code == "sale_blocked_by_future_reservation"


@pytest.mark.asyncio
async def test_cancelled_reservation_allows_sale(
    sale_service: SaleService,
    reservation_service,
    sample_customer,
    sample_dress,
) -> None:
    draft = await reservation_service.create(
        customer_id=sample_customer.id,
        reservation_at=utc(2026, 7, 1),
        rental_start_at=utc(2026, 12, 1, 10),
        expected_return_at=utc(2026, 12, 3, 10),
        items=[{"dress_id": sample_dress.id}],
    )
    confirmed = await reservation_service.confirm(draft.id)
    cancelled = await reservation_service.cancel(confirmed.id)
    assert cancelled.status == ReservationStatus.CANCELLED.value

    sale = await sale_service.create(
        origin=SaleOrigin.NORMAL_SALE,
        items=[normal_item(sample_dress.id)],
        payment=payment(sample_dress.default_sale_price),
    )
    assert sale.status == SaleStatus.COMPLETED.value


@pytest.mark.asyncio
async def test_unavailable_dress_statuses_rejected(
    sale_service: SaleService,
    rental_service,
    return_service,
    inspection_service,
    dress_service,
    sample_category,
    sample_customer,
) -> None:
    rented = await build_available_dress(
        dress_service=dress_service,
        sample_category=sample_category,
        name_ar="مؤجر",
    )
    await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=utc(2026, 8, 1, 10),
        expected_return_at=utc(2026, 8, 3, 10),
        initial_payment_type="FIXED_AMOUNT",
        initial_payment_value=0,
        items=[{"dress_id": rented.id}],
    )
    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.NORMAL_SALE,
            items=[normal_item(rented.id)],
            payment=payment(rented.default_sale_price),
        )

    proc_dress = await build_available_dress(
        dress_service=dress_service,
        sample_category=sample_category,
        name_ar="غسيل",
    )
    rental = await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=utc(2026, 10, 1, 10),
        expected_return_at=utc(2026, 10, 2, 10),
        initial_payment_type="FIXED_AMOUNT",
        initial_payment_value=0,
        items=[{"dress_id": proc_dress.id}],
    )
    ret = await return_service.create(rental_id=rental.id, returned_at=utc(2026, 10, 2, 10))
    insp = await inspection_service.create(return_id=ret.id)
    item = next(i for i in insp.items if not i.is_deleted)
    await inspection_service.update(
        insp.id,
        items=[{"id": item.id, "condition": "GOOD", "requires_laundry": True}],
        complete=True,
    )
    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.NORMAL_SALE,
            items=[normal_item(proc_dress.id)],
            payment=payment(proc_dress.default_sale_price),
        )

    deleted = await build_available_dress(
        dress_service=dress_service,
        sample_category=sample_category,
        name_ar="محذوف",
    )
    await dress_service.soft_delete(deleted.id)
    with pytest.raises(NotFoundError):
        await sale_service.create(
            origin=SaleOrigin.NORMAL_SALE,
            items=[normal_item(deleted.id)],
            payment=payment(deleted.default_sale_price),
        )


@pytest.mark.asyncio
async def test_price_override_disabled(
    sale_service: SaleService,
    sample_dress,
    db_session: AsyncSession,
) -> None:
    await _set_bool_setting(db_session, SettingKey.ALLOW_MANUAL_SALE_PRICE_OVERRIDE, False)
    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.NORMAL_SALE,
            items=[normal_item(sample_dress.id, actual_sale_price=1500)],
            payment=payment(1500),
        )


@pytest.mark.asyncio
async def test_duplicate_dress_and_payment_mismatch(
    sale_service: SaleService,
    dress_service,
    sample_category,
) -> None:
    dress = await build_available_dress(
        dress_service=dress_service,
        sample_category=sample_category,
    )
    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.NORMAL_SALE,
            items=[normal_item(dress.id), normal_item(dress.id)],
            payment=payment(dress.default_sale_price * 2),
        )

    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.NORMAL_SALE,
            items=[normal_item(dress.id)],
            payment=payment(dress.default_sale_price + 1),
        )


@pytest.mark.asyncio
async def test_mandatory_damage_purchase_success(
    sale_service: SaleService,
    rental_service,
    return_service,
    inspection_service,
    sample_customer,
    sample_dress,
    db_session: AsyncSession,
) -> None:
    ctx = await build_ruined_pending_context(
        rental_service=rental_service,
        return_service=return_service,
        inspection_service=inspection_service,
        customer=sample_customer,
        dress=sample_dress,
        rental_at=utc(2026, 8, 1, 10),
        expected_return_at=utc(2026, 8, 2, 10),
        returned_at=utc(2026, 8, 2, 10),
    )
    insp_item = ctx["inspection_item"]
    sale = await sale_service.create(
        origin=SaleOrigin.MANDATORY_DAMAGE_PURCHASE,
        customer_id=sample_customer.id,
        inspection_item_id=insp_item.id,
        items=[normal_item(sample_dress.id)],
        payment=payment(sample_dress.default_sale_price),
    )
    assert sale.origin == SaleOrigin.MANDATORY_DAMAGE_PURCHASE.value
    assert sale.rental_id == ctx["rental"].id
    assert sale.return_id == ctx["return"].id
    assert sale.inspection_id == ctx["inspection"].id
    assert sale.items[0].inspection_item_id == insp_item.id

    status_svc = DressStatusService(db_session)
    assert await status_svc.get_current_status(sample_dress.id) == DressStatus.SOLD.value


@pytest.mark.asyncio
async def test_mandatory_customer_mismatch_and_duplicate(
    sale_service: SaleService,
    rental_service,
    return_service,
    inspection_service,
    customer_service,
    dress_service,
    sample_category,
    sample_customer,
) -> None:
    dress_a = await build_available_dress(
        dress_service=dress_service,
        sample_category=sample_category,
        name_ar="الزامي ا",
    )
    ctx = await build_ruined_pending_context(
        rental_service=rental_service,
        return_service=return_service,
        inspection_service=inspection_service,
        customer=sample_customer,
        dress=dress_a,
        rental_at=utc(2026, 8, 5, 10),
        expected_return_at=utc(2026, 8, 6, 10),
        returned_at=utc(2026, 8, 6, 10),
    )
    other = await customer_service.create_customer(
        full_name="عميلة اخرى",
        phone="07001112244",
    )
    with pytest.raises(BusinessError) as exc:
        await sale_service.create(
            origin=SaleOrigin.MANDATORY_DAMAGE_PURCHASE,
            customer_id=other.id,
            inspection_item_id=ctx["inspection_item"].id,
            items=[normal_item(dress_a.id)],
            payment=payment(dress_a.default_sale_price),
        )
    assert exc.value.code == "sale_customer_mismatch"

    await sale_service.create(
        origin=SaleOrigin.MANDATORY_DAMAGE_PURCHASE,
        customer_id=sample_customer.id,
        inspection_item_id=ctx["inspection_item"].id,
        items=[normal_item(dress_a.id)],
        payment=payment(dress_a.default_sale_price),
    )

    dress_b = await build_available_dress(
        dress_service=dress_service,
        sample_category=sample_category,
        name_ar="الزامي ب",
    )
    ctx_b = await build_ruined_pending_context(
        rental_service=rental_service,
        return_service=return_service,
        inspection_service=inspection_service,
        customer=sample_customer,
        dress=dress_b,
        rental_at=utc(2026, 9, 5, 10),
        expected_return_at=utc(2026, 9, 6, 10),
        returned_at=utc(2026, 9, 6, 10),
    )
    await sale_service.create(
        origin=SaleOrigin.MANDATORY_DAMAGE_PURCHASE,
        customer_id=sample_customer.id,
        inspection_item_id=ctx_b["inspection_item"].id,
        items=[normal_item(dress_b.id)],
        payment=payment(dress_b.default_sale_price),
    )
    with pytest.raises(ConflictError):
        await sale_service.create(
            origin=SaleOrigin.MANDATORY_DAMAGE_PURCHASE,
            customer_id=sample_customer.id,
            inspection_item_id=ctx_b["inspection_item"].id,
            items=[normal_item(dress_b.id)],
            payment=payment(dress_b.default_sale_price),
        )


@pytest.mark.asyncio
async def test_ruined_pending_normal_sale_rejected(
    sale_service: SaleService,
    rental_service,
    return_service,
    inspection_service,
    sample_customer,
    sample_dress,
) -> None:
    await build_ruined_pending_context(
        rental_service=rental_service,
        return_service=return_service,
        inspection_service=inspection_service,
        customer=sample_customer,
        dress=sample_dress,
        rental_at=utc(2026, 8, 10, 10),
        expected_return_at=utc(2026, 8, 11, 10),
        returned_at=utc(2026, 8, 11, 10),
    )
    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.NORMAL_SALE,
            items=[normal_item(sample_dress.id)],
            payment=payment(sample_dress.default_sale_price),
        )


@pytest.mark.asyncio
async def test_audit_rows_and_list_get(
    sale_service: SaleService,
    sample_dress,
    sample_customer,
    db_session: AsyncSession,
) -> None:
    sale = await sale_service.create(
        origin=SaleOrigin.NORMAL_SALE,
        customer_id=sample_customer.id,
        items=[normal_item(sample_dress.id)],
        payment=payment(sample_dress.default_sale_price),
        notes="  ",
    )
    assert sale.sale_number.startswith("SAL")
    assert sale.notes is None

    audit = AuditService(db_session)
    logs, _ = await audit.list_logs(module="sales", entity_id=str(sale.id))
    actions = {row.action for row in logs}
    assert AuditAction.CREATE.value in actions
    assert AuditAction.COMPLETE.value in actions

    rows, total = await sale_service.list(customer_id=sample_customer.id, sort_dir="asc")
    assert total == 1
    assert rows[0].id == sale.id

    with pytest.raises(ValidationError):
        await sale_service.list(sort_by="nope")
    with pytest.raises(ValidationError):
        await sale_service.list(sort_dir="sideways")
    with pytest.raises(ValidationError):
        await sale_service.list(status="NOPE")
    with pytest.raises(ValidationError):
        await sale_service.list(origin="NOPE")
    with pytest.raises(NotFoundError):
        await sale_service.get(uuid4())


@pytest.mark.asyncio
async def test_create_validation_edges(
    sale_service: SaleService,
    dress_service,
    sample_category,
    sample_customer,
    db_session: AsyncSession,
) -> None:
    dress = await build_available_dress(
        dress_service=dress_service,
        sample_category=sample_category,
    )
    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.NORMAL_SALE,
            items=[],
            payment=payment(1),
        )
    with pytest.raises(ValidationError):
        await sale_service.create(
            origin="NOT_A_SALE",
            items=[normal_item(dress.id)],
            payment=payment(dress.default_sale_price),
        )
    with pytest.raises(NotFoundError):
        await sale_service.create(
            origin=SaleOrigin.NORMAL_SALE,
            customer_id=uuid4(),
            items=[normal_item(dress.id)],
            payment=payment(dress.default_sale_price),
        )

    inactive = await build_available_dress(
        dress_service=dress_service,
        sample_category=sample_category,
        name_ar="غير نشط",
    )
    await dress_service.deactivate(inactive.id)
    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.NORMAL_SALE,
            items=[normal_item(inactive.id)],
            payment=payment(inactive.default_sale_price),
        )

    with pytest.raises(ValidationError):
        await sale_service.create(
            origin="BOGUS_ORIGIN",
            items=[normal_item(dress.id)],
            payment=payment(dress.default_sale_price),
        )

    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.MANDATORY_DAMAGE_PURCHASE,
            customer_id=sample_customer.id,
            items=[normal_item(dress.id)],
            payment=payment(dress.default_sale_price),
        )
    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.MANDATORY_DAMAGE_PURCHASE,
            inspection_item_id=uuid4(),
            items=[normal_item(dress.id), normal_item(dress.id)],
            payment=payment(dress.default_sale_price * 2),
        )

    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.NORMAL_SALE,
            items=[normal_item(dress.id)],
            payment=payment(dress.default_sale_price),
            notes="X" * 2001,
        )

    override_sale = await sale_service.create(
        origin=SaleOrigin.NORMAL_SALE,
        items=[normal_item(dress.id, actual_sale_price=2500)],
        payment=payment(2500),
    )
    assert override_sale.total_amount == 2500

    long_ref = "X" * 101
    ref_dress = await build_available_dress(
        dress_service=dress_service,
        sample_category=sample_category,
        name_ar="مرجع",
    )
    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.NORMAL_SALE,
            items=[normal_item(ref_dress.id)],
            payment=SalePaymentCreateRequest.model_construct(
                amount=ref_dress.default_sale_price,
                payment_method="CASH",
                reference_number="X" * 101,
            ),
        )

    wire_dress = await build_available_dress(
        dress_service=dress_service,
        sample_category=sample_category,
        name_ar="دفع",
    )
    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.NORMAL_SALE,
            items=[normal_item(wire_dress.id)],
            payment=SalePaymentCreateRequest.model_construct(
                amount=wire_dress.default_sale_price,
                payment_method="WIRE",
            ),
        )


@pytest.mark.asyncio
async def test_mandatory_inspection_validation(
    sale_service: SaleService,
    rental_service,
    return_service,
    inspection_service,
    dress_service,
    sample_category,
    sample_customer,
) -> None:
    dress = await build_available_dress(
        dress_service=dress_service,
        sample_category=sample_category,
        name_ar="فحص الزامي",
    )
    rental = await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=utc(2026, 11, 1, 10),
        expected_return_at=utc(2026, 11, 2, 10),
        initial_payment_type="FIXED_AMOUNT",
        initial_payment_value=0,
        items=[{"dress_id": dress.id}],
    )
    ret = await return_service.create(rental_id=rental.id, returned_at=utc(2026, 11, 2, 10))
    insp = await inspection_service.create(return_id=ret.id)
    item = next(i for i in insp.items if not i.is_deleted)

    with pytest.raises(NotFoundError):
        await sale_service.create(
            origin=SaleOrigin.MANDATORY_DAMAGE_PURCHASE,
            customer_id=sample_customer.id,
            inspection_item_id=uuid4(),
            items=[normal_item(dress.id)],
            payment=payment(dress.default_sale_price),
        )

    await inspection_service.update(
        insp.id,
        items=[{"id": item.id, "condition": "GOOD", "requires_laundry": False}],
        complete=True,
    )
    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.MANDATORY_DAMAGE_PURCHASE,
            customer_id=sample_customer.id,
            inspection_item_id=item.id,
            items=[normal_item(dress.id)],
            payment=payment(dress.default_sale_price),
        )

    other = await build_available_dress(
        dress_service=dress_service,
        sample_category=sample_category,
        name_ar="مismatch",
    )
    rental2 = await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=utc(2026, 11, 5, 10),
        expected_return_at=utc(2026, 11, 6, 10),
        initial_payment_type="FIXED_AMOUNT",
        initial_payment_value=0,
        items=[{"dress_id": other.id}],
    )
    ret2 = await return_service.create(rental_id=rental2.id, returned_at=utc(2026, 11, 6, 10))
    insp2 = await inspection_service.create(return_id=ret2.id)
    major_item = next(i for i in insp2.items if not i.is_deleted)
    await inspection_service.update(
        insp2.id,
        items=[
            {
                "id": major_item.id,
                "condition": "MAJOR_DAMAGE",
                "send_to_ruined": True,
                "requires_laundry": False,
            }
        ],
        complete=True,
    )
    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.MANDATORY_DAMAGE_PURCHASE,
            customer_id=sample_customer.id,
            inspection_item_id=major_item.id,
            items=[normal_item(dress.id)],
            payment=payment(dress.default_sale_price),
        )


@pytest.mark.asyncio
async def test_past_reservation_does_not_block(
    sale_service: SaleService,
    calendar_service,
    dress_service,
    sample_category,
) -> None:
    dress = await build_available_dress(
        dress_service=dress_service,
        sample_category=sample_category,
        name_ar="حجز سابق",
    )
    await calendar_service.create_block(
        dress_id=dress.id,
        block_type="RESERVATION",
        start_at=utc(2026, 1, 1, 10),
        end_at=utc(2026, 1, 3, 10),
        reference_module="reservations",
        reference_id=uuid4(),
    )
    sale = await sale_service.create(
        origin=SaleOrigin.NORMAL_SALE,
        items=[normal_item(dress.id)],
        payment=payment(dress.default_sale_price),
    )
    assert sale.status == SaleStatus.COMPLETED.value


@pytest.mark.asyncio
async def test_mandatory_preconditions(
    sale_service: SaleService,
    rental_service,
    return_service,
    inspection_service,
    dress_service,
    sample_category,
    sample_customer,
    db_session: AsyncSession,
) -> None:
    from app.modules.inspection.models import InspectionItem

    dress = await build_available_dress(
        dress_service=dress_service,
        sample_category=sample_category,
        name_ar="شروط",
    )
    rental = await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=utc(2026, 12, 1, 10),
        expected_return_at=utc(2026, 12, 2, 10),
        initial_payment_type="FIXED_AMOUNT",
        initial_payment_value=0,
        items=[{"dress_id": dress.id}],
    )
    ret = await return_service.create(rental_id=rental.id, returned_at=utc(2026, 12, 2, 10))
    insp = await inspection_service.create(return_id=ret.id)
    item = next(i for i in insp.items if not i.is_deleted)

    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.MANDATORY_DAMAGE_PURCHASE,
            inspection_item_id=item.id,
            items=[normal_item(dress.id)],
            payment=payment(dress.default_sale_price),
        )

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

    result = await db_session.execute(
        select(InspectionItem).where(InspectionItem.id == item.id)
    )
    db_item = result.scalar_one()
    db_item.send_to_ruined = False
    await db_session.flush()
    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.MANDATORY_DAMAGE_PURCHASE,
            customer_id=sample_customer.id,
            inspection_item_id=item.id,
            items=[normal_item(dress.id)],
            payment=payment(dress.default_sale_price),
        )

    db_item.send_to_ruined = True
    db_item.repair_penalty_amount = 5000
    await db_session.flush()
    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.MANDATORY_DAMAGE_PURCHASE,
            customer_id=sample_customer.id,
            inspection_item_id=item.id,
            items=[normal_item(dress.id)],
            payment=payment(dress.default_sale_price),
        )

    db_item.repair_penalty_amount = None
    await db_session.flush()
    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.MANDATORY_DAMAGE_PURCHASE,
            customer_id=sample_customer.id,
            inspection_item_id=item.id,
            items=[normal_item(dress.id), normal_item(dress.id)],
            payment=payment(dress.default_sale_price * 2),
        )


@pytest.mark.asyncio
async def test_mandatory_eligibility_and_payment_edges(
    sale_service: SaleService,
    rental_service,
    return_service,
    inspection_service,
    dress_service,
    sample_category,
    sample_customer,
    db_session: AsyncSession,
) -> None:
    from app.modules.inspection.models import InspectionItem
    from app.modules.inventory.models import Dress

    dress = await build_available_dress(
        dress_service=dress_service,
        sample_category=sample_category,
        name_ar="الزامي متقدم",
    )
    rental = await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=utc(2026, 12, 10, 10),
        expected_return_at=utc(2026, 12, 11, 10),
        initial_payment_type="FIXED_AMOUNT",
        initial_payment_value=0,
        items=[{"dress_id": dress.id}],
    )
    ret = await return_service.create(rental_id=rental.id, returned_at=utc(2026, 12, 11, 10))
    insp = await inspection_service.create(return_id=ret.id)
    item = next(i for i in insp.items if not i.is_deleted)
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
    )
    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.MANDATORY_DAMAGE_PURCHASE,
            customer_id=sample_customer.id,
            inspection_item_id=item.id,
            items=[normal_item(dress.id)],
            payment=payment(dress.default_sale_price),
        )

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

    dress_row = await db_session.get(Dress, dress.id)
    assert dress_row is not None
    dress_row.status = DressStatus.AVAILABLE.value
    await db_session.flush()
    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.MANDATORY_DAMAGE_PURCHASE,
            customer_id=sample_customer.id,
            inspection_item_id=item.id,
            items=[normal_item(dress.id)],
            payment=payment(dress.default_sale_price),
        )

    dress_row.status = DressStatus.RUINED_PENDING_SALE.value
    await db_session.flush()

    await _set_bool_setting(db_session, SettingKey.ALLOW_MANUAL_SALE_PRICE_OVERRIDE, False)
    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.MANDATORY_DAMAGE_PURCHASE,
            customer_id=sample_customer.id,
            inspection_item_id=item.id,
            items=[normal_item(dress.id, actual_sale_price=9999)],
            payment=payment(9999),
        )

    with pytest.raises(ValidationError):
        await sale_service.create(
            origin=SaleOrigin.MANDATORY_DAMAGE_PURCHASE,
            customer_id=sample_customer.id,
            inspection_item_id=item.id,
            items=[normal_item(dress.id)],
            payment=SalePaymentCreateRequest.model_construct(
                amount=dress.default_sale_price,
                payment_method="INVALID",
            ),
        )
