"""Extra inspection edge coverage."""

from uuid import uuid4

import pytest
from app.exceptions import ValidationError
from app.modules.inspection.services.inspection import InspectionService
from app.modules.inspection.services.inspection_number import (
    InspectionNumberConfig,
    InspectionNumberService,
)
from app.modules.settings.models.setting import Setting
from app.modules.settings.services.setting import SettingService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def _set_setting_raw(session: AsyncSession, key: str, value: str) -> None:
    result = await session.execute(
        select(Setting).where(Setting.key == key, Setting.is_deleted.is_(False))
    )
    row = result.scalar_one()
    row.value = value
    await session.flush()


@pytest.mark.asyncio
async def test_number_service_and_complete_guards(
    db_session: AsyncSession,
    inspection_service: InspectionService,
    pending_return,
    rental_service,
    return_service,
    dress_service,
    sample_customer,
    sample_category,
) -> None:
    from tests.modules.inspection.conftest import utc

    numbers = InspectionNumberService(db_session, settings=SettingService(db_session))
    config = await numbers.load_config()
    assert numbers.format(1, config=config).startswith("INS")
    with pytest.raises(ValidationError):
        numbers.format(0, config=config)

    await _set_setting_raw(db_session, "inspection.number.prefix", "BAD!")
    with pytest.raises(ValidationError):
        await numbers.load_config()
    await _set_setting_raw(db_session, "inspection.number.prefix", "INS")
    await _set_setting_raw(db_session, "inspection.number.separator", "*")
    with pytest.raises(ValidationError):
        await numbers.load_config()
    await _set_setting_raw(db_session, "inspection.number.separator", "-")
    await _set_setting_raw(db_session, "inspection.number.padding", "0")
    with pytest.raises(ValidationError):
        await numbers.load_config()
    await _set_setting_raw(db_session, "inspection.number.padding", "8")
    assert InspectionNumberConfig(prefix="INS", separator="-", padding=8)

    insp = await inspection_service.create(return_id=pending_return.id)
    with pytest.raises(ValidationError):
        await inspection_service.update(insp.id)
    with pytest.raises(ValidationError):
        await inspection_service.update(insp.id, complete=True)
    with pytest.raises(ValidationError):
        await inspection_service.update(
            insp.id,
            items=[{"id": uuid4(), "condition": "GOOD"}],
        )

    items = [i for i in insp.items if not i.is_deleted]
    await inspection_service.update(
        insp.id,
        items=[
            {
                "id": items[0].id,
                "condition": "GOOD",
                "requires_laundry": False,
            },
            {
                "id": items[1].id,
                "condition": "GOOD",
                "requires_laundry": False,
            },
        ],
        complete=True,
    )
    with pytest.raises(ValidationError):
        await inspection_service.update(insp.id, notes="بعد الإكمال")

    with pytest.raises(ValidationError):
        await inspection_service.list(sort_by="nope")

    # major with laundry forbidden
    d = await dress_service.create_dress(
        category_id=sample_category.id,
        name_ar="فحص حافة",
        size="S",
        colour="GOLD",
        purchase_price=700,
        default_daily_rental_price=70,
        default_sale_price=1400,
    )
    rental = await rental_service.create(
        customer_id=sample_customer.id,
        rental_at=utc(2026, 10, 1),
        expected_return_at=utc(2026, 10, 2),
        initial_payment_type="FIXED_AMOUNT",
        initial_payment_value=0,
        items=[{"dress_id": d.id}],
    )
    ret = await return_service.create(rental_id=rental.id)
    insp2 = await inspection_service.create(return_id=ret.id)
    item = [i for i in insp2.items if not i.is_deleted][0]
    with pytest.raises(ValidationError):
        await inspection_service.update(
            insp2.id,
            items=[
                {
                    "id": item.id,
                    "condition": "MAJOR_DAMAGE",
                    "send_to_ruined": True,
                    "requires_laundry": True,
                }
            ],
        )
