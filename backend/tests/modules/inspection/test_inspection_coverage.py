"""Coverage-oriented inspection edge cases."""

from uuid import uuid4

import pytest
from app.exceptions import ValidationError
from app.modules.inspection.constants import DressCondition
from app.modules.inspection.repositories.inspection import (
    InspectionItemRepository,
    InspectionRepository,
)
from app.modules.inspection.schemas.inspection import (
    InspectionCreateRequest,
    InspectionItemUpdateInput,
    InspectionUpdateRequest,
)
from app.modules.inspection.services.inspection import (
    InspectionService,
    _normalize_notes,
    _validate_item_fields,
)
from app.modules.inspection.services.inspection_number import (
    InspectionNumberConfig,
    InspectionNumberService,
)
from app.modules.inventory.models.barcode_counter import BarcodeCounter
from app.modules.returns.constants import ReturnStatus
from app.modules.settings.models.setting import Setting
from app.modules.settings.services.setting import SettingService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.modules.inspection.conftest import utc


async def _set_setting(session: AsyncSession, key: str, value: str) -> None:
    result = await session.execute(
        select(Setting).where(Setting.key == key, Setting.is_deleted.is_(False))
    )
    row = result.scalar_one()
    row.value = value
    await session.flush()


def test_schema_stripping_and_validators() -> None:
    assert InspectionCreateRequest(return_id=uuid4(), notes="  ").notes is None
    assert InspectionCreateRequest(return_id=uuid4(), notes=" hi ").notes == "hi"
    assert InspectionUpdateRequest(notes="  ").notes is None
    assert InspectionUpdateRequest(notes=" x ").notes == "x"
    item = InspectionItemUpdateInput(id=uuid4(), condition=" good ")
    assert item.condition == "GOOD"
    item2 = InspectionItemUpdateInput(
        id=uuid4(),
        condition="MINOR_DAMAGE",
        repair_notes="  ",
        notes="  note  ",
    )
    assert item2.repair_notes is None
    assert item2.notes == "note"
    # non-string passes through validators
    assert InspectionItemUpdateInput.model_validate(
        {"id": uuid4(), "condition": DressCondition.GOOD}
    ).condition == DressCondition.GOOD


def test_normalize_and_validate_helpers() -> None:
    assert _normalize_notes(None, max_length=10, field="n") is None
    assert _normalize_notes("  ", max_length=10, field="n") is None
    assert _normalize_notes("ok", max_length=10, field="n") == "ok"
    with pytest.raises(ValidationError):
        _normalize_notes("x" * 11, max_length=10, field="n")

    with pytest.raises(ValidationError):
        _validate_item_fields(
            condition="NOPE",
            repair_penalty_amount=None,
            requires_laundry=False,
            send_to_ruined=False,
        )
    with pytest.raises(ValidationError):
        _validate_item_fields(
            condition="GOOD",
            repair_penalty_amount=None,
            requires_laundry=False,
            send_to_ruined=True,
        )
    with pytest.raises(ValidationError):
        _validate_item_fields(
            condition="MINOR_DAMAGE",
            repair_penalty_amount=10,
            requires_laundry=True,
            send_to_ruined=True,
        )
    with pytest.raises(ValidationError):
        _validate_item_fields(
            condition="MINOR_DAMAGE",
            repair_penalty_amount=10,
            requires_laundry=False,
            send_to_ruined=False,
        )
    with pytest.raises(ValidationError):
        _validate_item_fields(
            condition="MAJOR_DAMAGE",
            repair_penalty_amount=1,
            requires_laundry=False,
            send_to_ruined=True,
        )
    ok = _validate_item_fields(
        condition=DressCondition.GOOD,
        repair_penalty_amount=None,
        requires_laundry=True,
        send_to_ruined=False,
    )
    assert ok[0] == "GOOD"


@pytest.mark.asyncio
async def test_partial_update_notes_and_list_sort(
    inspection_service: InspectionService,
    pending_return,
    db_session: AsyncSession,
) -> None:
    insp = await inspection_service.create(
        return_id=pending_return.id,
        notes="أولية",
    )
    assert "INS-" in repr(insp) and "PENDING" in repr(insp)
    item = [i for i in insp.items if not i.is_deleted][0]
    assert "InspectionItem" in repr(item)

    updated = await inspection_service.update(
        insp.id,
        notes="محدّثة",
        items=[
            {
                "id": item.id,
                "condition": "GOOD",
                "requires_laundry": False,
                "notes": "ملاحظة عنصر",
                "repair_notes": None,
            }
        ],
    )
    assert updated.status == "PENDING"
    assert updated.notes == "محدّثة"

    cleared = await inspection_service.update(insp.id, clear_notes=True)
    assert cleared.notes is None

    rows, total = await inspection_service.list(
        sort_by="inspection_number",
        sort_dir="asc",
        return_id=pending_return.id,
    )
    assert total == 1
    assert rows[0].id == insp.id

    with pytest.raises(ValidationError):
        await inspection_service.list(sort_dir="sideways")

    repo = InspectionRepository(db_session)
    found = await repo.get_by_inspection_number(
        insp.inspection_number,
        exclude_id=uuid4(),
    )
    assert found is not None
    item_repo = InspectionItemRepository(db_session)
    assert await item_repo.get_by_id(item.id) is not None


@pytest.mark.asyncio
async def test_create_rejects_wrong_return_status(
    inspection_service: InspectionService,
    rental_service,
    return_service,
    sample_customer,
    sample_dress,
    sample_category,
    dress_service,
    db_session: AsyncSession,
) -> None:
    d = await dress_service.create_dress(
        category_id=sample_category.id,
        name_ar="فحص حالة",
        size="M",
        colour="GREEN",
        purchase_price=800,
        default_daily_rental_price=80,
        default_sale_price=1600,
    )
    rental = await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=utc(2026, 11, 1),
        expected_return_at=utc(2026, 11, 2),
        initial_payment_type="FIXED_AMOUNT",
        initial_payment_value=0,
        items=[{"dress_id": d.id}],
    )
    ret = await return_service.create(rental_id=rental.id)
    # Force wrong status after create
    ret.status = ReturnStatus.INSPECTION_COMPLETED.value
    await db_session.flush()
    with pytest.raises(ValidationError):
        await inspection_service.create(return_id=ret.id)


@pytest.mark.asyncio
async def test_update_requires_condition_and_complete_missing(
    inspection_service: InspectionService,
    pending_return,
) -> None:
    insp = await inspection_service.create(return_id=pending_return.id)
    item = [i for i in insp.items if not i.is_deleted][0]
    with pytest.raises(ValidationError):
        await inspection_service.update(
            insp.id,
            items=[{"id": item.id, "condition": None}],
        )
    # Fill only one of two items then complete
    await inspection_service.update(
        insp.id,
        items=[{"id": item.id, "condition": "GOOD", "requires_laundry": False}],
    )
    with pytest.raises(ValidationError):
        await inspection_service.update(insp.id, complete=True)


@pytest.mark.asyncio
async def test_number_overflow_and_collision_skip(
    db_session: AsyncSession,
    inspection_service: InspectionService,
    pending_return,
) -> None:
    numbers = InspectionNumberService(db_session, settings=SettingService(db_session))
    config = InspectionNumberConfig(prefix="INS", separator="-", padding=1)
    with pytest.raises(ValidationError):
        numbers.format(10, config=config)

    insp = await inspection_service.create(return_id=pending_return.id)
    next_num = await numbers.generate_next()
    assert next_num != insp.inspection_number

    await _set_setting(db_session, "inspection.number.padding", "1")
    counter = (
        await db_session.execute(select(BarcodeCounter).where(BarcodeCounter.prefix == "INS"))
    ).scalar_one()
    counter.last_value = 0
    await db_session.flush()

    async def _always_taken(*_a: object, **_k: object) -> bool:
        return True

    numbers.exists = _always_taken  # type: ignore[method-assign]
    with pytest.raises(ValidationError):
        await numbers.generate_next()
    await _set_setting(db_session, "inspection.number.padding", "8")
