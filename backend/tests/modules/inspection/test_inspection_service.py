"""InspectionService unit tests."""

from uuid import uuid4

import pytest
from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.inspection.constants import DressCondition, InspectionStatus
from app.modules.inspection.services.inspection import InspectionService
from app.modules.inventory.constants import DressStatus
from app.modules.inventory.services.dress_status import DressStatusService
from app.modules.returns.constants import ReturnStatus
from app.modules.returns.services.return_service import ReturnService
from sqlalchemy.ext.asyncio import AsyncSession
from tests.modules.inspection.conftest import utc


@pytest.mark.asyncio
async def test_good_with_and_without_laundry(
    inspection_service: InspectionService,
    pending_return,
    sample_dress,
    sample_dress_b,
    db_session: AsyncSession,
) -> None:
    insp = await inspection_service.create(return_id=pending_return.id)
    assert insp.status == InspectionStatus.PENDING.value
    items = [i for i in insp.items if not i.is_deleted]
    assert len(items) == 2

    by_dress = {i.dress_id: i for i in items}
    completed = await inspection_service.update(
        insp.id,
        items=[
            {
                "id": by_dress[sample_dress.id].id,
                "condition": DressCondition.GOOD.value,
                "requires_laundry": False,
            },
            {
                "id": by_dress[sample_dress_b.id].id,
                "condition": DressCondition.GOOD.value,
                "requires_laundry": True,
            },
        ],
        complete=True,
        actor_username="admin",
    )
    assert completed.status == InspectionStatus.COMPLETED.value
    assert completed.inspected_at is not None

    status_svc = DressStatusService(db_session)
    assert await status_svc.get_current_status(sample_dress.id) == DressStatus.AVAILABLE.value
    assert await status_svc.get_current_status(sample_dress_b.id) == DressStatus.PROCESSING.value

    ret = await ReturnService(db_session).get(pending_return.id)
    assert ret.status == ReturnStatus.INSPECTION_COMPLETED.value

    audit = AuditService(db_session)
    logs, _ = await audit.list_logs(module="inspection", entity_id=str(insp.id))
    actions = {row.action for row in logs}
    assert AuditAction.CREATE.value in actions
    assert AuditAction.COMPLETE.value in actions


@pytest.mark.asyncio
async def test_minor_and_major_damage(
    inspection_service: InspectionService,
    rental_service,
    return_service,
    dress_service,
    sample_customer,
    sample_category,
    db_session: AsyncSession,
) -> None:
    d1 = await dress_service.create_dress(
        category_id=sample_category.id,
        name_ar="ضرر بسيط",
        size="M",
        colour="BLACK",
        purchase_price=900,
        default_daily_rental_price=90,
        default_sale_price=1800,
    )
    d2 = await dress_service.create_dress(
        category_id=sample_category.id,
        name_ar="ضرر جسيم",
        size="L",
        colour="WHITE",
        purchase_price=1100,
        default_daily_rental_price=110,
        default_sale_price=2200,
    )
    rental = await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=utc(2026, 9, 1),
        expected_return_at=utc(2026, 9, 2),
        initial_payment_type="FIXED_AMOUNT",
        initial_payment_value=0,
        items=[{"dress_id": d1.id}, {"dress_id": d2.id}],
    )
    ret = await return_service.create(rental_id=rental.id)
    insp = await inspection_service.create(return_id=ret.id)
    by_dress = {i.dress_id: i for i in insp.items if not i.is_deleted}

    with pytest.raises(ValidationError):
        await inspection_service.update(
            insp.id,
            items=[
                {
                    "id": by_dress[d1.id].id,
                    "condition": "MINOR_DAMAGE",
                    "requires_laundry": True,
                    # missing penalty
                }
            ],
        )

    with pytest.raises(ValidationError):
        await inspection_service.update(
            insp.id,
            items=[
                {
                    "id": by_dress[d1.id].id,
                    "condition": "GOOD",
                    "repair_penalty_amount": 100,
                }
            ],
        )

    with pytest.raises(ValidationError):
        await inspection_service.update(
            insp.id,
            items=[
                {
                    "id": by_dress[d2.id].id,
                    "condition": "MAJOR_DAMAGE",
                    "send_to_ruined": False,
                }
            ],
        )

    completed = await inspection_service.update(
        insp.id,
        items=[
            {
                "id": by_dress[d1.id].id,
                "condition": "MINOR_DAMAGE",
                "repair_penalty_amount": 5000,
                "requires_laundry": True,
                "repair_notes": "خياطة بسيطة",
            },
            {
                "id": by_dress[d2.id].id,
                "condition": "MAJOR_DAMAGE",
                "send_to_ruined": True,
                "requires_laundry": False,
            },
        ],
        complete=True,
    )
    assert completed.status == InspectionStatus.COMPLETED.value
    status_svc = DressStatusService(db_session)
    assert await status_svc.get_current_status(d1.id) == DressStatus.PROCESSING.value
    assert await status_svc.get_current_status(d2.id) == DressStatus.RUINED_PENDING_SALE.value


@pytest.mark.asyncio
async def test_duplicate_inspection_and_list(
    inspection_service: InspectionService,
    pending_return,
) -> None:
    first = await inspection_service.create(return_id=pending_return.id)
    with pytest.raises(ConflictError):
        await inspection_service.create(return_id=pending_return.id)

    rows, total = await inspection_service.list(
        status="pending",
        return_id=pending_return.id,
    )
    assert total == 1
    assert rows[0].id == first.id

    with pytest.raises(NotFoundError):
        await inspection_service.get(uuid4())
    with pytest.raises(ValidationError):
        await inspection_service.list(status="NOPE")
