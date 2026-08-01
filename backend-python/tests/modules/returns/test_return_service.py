"""ReturnService unit tests."""

from uuid import uuid4

import pytest
from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.calendar.services.calendar import CalendarService
from app.modules.inventory.constants import DressStatus
from app.modules.inventory.services.dress_status import DressStatusService
from app.modules.rentals.constants import InitialPaymentType, RentalStatus
from app.modules.rentals.services.rental import RentalService
from app.modules.returns.constants import ReturnStatus
from app.modules.returns.services.return_service import ReturnService
from sqlalchemy.ext.asyncio import AsyncSession
from tests.modules.returns.conftest import utc


@pytest.mark.asyncio
async def test_create_return_status_and_audit(
    return_service: ReturnService,
    active_rental,
    sample_dress,
    sample_dress_b,
    db_session: AsyncSession,
) -> None:
    record = await return_service.create(
        rental_id=active_rental.id,
        notes="استلام كامل",
        actor_username="admin",
    )
    assert record.status == ReturnStatus.PENDING_INSPECTION.value
    assert record.return_number.startswith("RET")
    assert record.rental_id == active_rental.id
    live = [i for i in record.items if not i.is_deleted]
    assert len(live) == 2

    status_svc = DressStatusService(db_session)
    assert await status_svc.get_current_status(sample_dress.id) == DressStatus.INSPECTION.value
    assert await status_svc.get_current_status(sample_dress_b.id) == DressStatus.INSPECTION.value

    rental_svc = RentalService(db_session)
    rental = await rental_svc.get(active_rental.id)
    assert rental.status == RentalStatus.RETURN_PENDING.value

    # Calendar RENTAL blocks untouched — dress still blocked for original window
    cal = CalendarService(db_session)
    assert not await cal.is_available(
        sample_dress.id,
        utc(2026, 8, 1, 10),
        utc(2026, 8, 3, 10),
    )
    live_rental_items = [i for i in rental.items if not i.is_deleted]
    assert all(i.calendar_block_id is not None for i in live_rental_items)

    audit = AuditService(db_session)
    ret_logs, _ = await audit.list_logs(module="returns", entity_id=str(record.id))
    assert any(row.action == AuditAction.CREATE.value for row in ret_logs)
    rent_logs, _ = await audit.list_logs(module="rentals", entity_id=str(active_rental.id))
    assert any(row.action == AuditAction.RETURN.value for row in rent_logs)


@pytest.mark.asyncio
async def test_duplicate_return_and_validation(
    return_service: ReturnService,
    rental_service: RentalService,
    dress_service,
    active_rental,
    sample_customer,
    sample_dress,
    sample_category,
    customer_service,
) -> None:
    await return_service.create(rental_id=active_rental.id)
    with pytest.raises(ConflictError):
        await return_service.create(rental_id=active_rental.id)

    other = await customer_service.create_customer(full_name="اخرى", phone="07001110000")
    free_dress = await dress_service.create_dress(
        category_id=sample_category.id,
        name_ar="فستان إرجاع مستقل",
        size="S",
        colour="GREEN",
        purchase_price=800,
        default_daily_rental_price=80,
        default_sale_price=1600,
    )
    rental2 = await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=utc(2026, 9, 1),
        expected_return_at=utc(2026, 9, 2),
        initial_payment_type=InitialPaymentType.FIXED_AMOUNT,
        initial_payment_value=0,
        items=[{"dress_id": free_dress.id}],
    )
    with pytest.raises(ValidationError):
        await return_service.create(rental_id=rental2.id, customer_id=other.id)

    with pytest.raises(ValidationError):
        await return_service.create(
            rental_id=rental2.id,
            returned_at=utc(2026, 9, 1).replace(tzinfo=None),
        )

    await return_service.create(rental_id=rental2.id)
    with pytest.raises(ConflictError):
        await return_service.create(rental_id=rental2.id)

    with pytest.raises(NotFoundError):
        await return_service.get(uuid4())


@pytest.mark.asyncio
async def test_list_filters(
    return_service: ReturnService,
    active_rental,
    sample_customer,
) -> None:
    created = await return_service.create(rental_id=active_rental.id)
    items, total = await return_service.list(
        status="pending_inspection",
        customer_id=sample_customer.id,
        rental_id=active_rental.id,
    )
    assert total == 1
    assert items[0].id == created.id

    with pytest.raises(ValidationError):
        await return_service.list(sort_by="nope")
    with pytest.raises(ValidationError):
        await return_service.list(status="NOPE")
