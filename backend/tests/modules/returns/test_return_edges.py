"""Extra return edge-case coverage."""

from datetime import datetime
from uuid import uuid4

import pytest
from app.exceptions import ValidationError
from app.modules.returns.schemas.return_record import ReturnCreateRequest
from app.modules.returns.services.return_number import ReturnNumberConfig, ReturnNumberService
from app.modules.returns.services.return_service import ReturnService
from app.modules.settings.models.setting import Setting
from app.modules.settings.services.setting import SettingService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.modules.returns.conftest import utc


async def _set_setting_raw(session: AsyncSession, key: str, value: str) -> None:
    result = await session.execute(
        select(Setting).where(Setting.key == key, Setting.is_deleted.is_(False))
    )
    row = result.scalar_one()
    row.value = value
    await session.flush()


@pytest.mark.asyncio
async def test_number_service_and_notes(
    db_session: AsyncSession,
    return_service: ReturnService,
    active_rental,
) -> None:
    numbers = ReturnNumberService(db_session, settings=SettingService(db_session))
    config = await numbers.load_config()
    assert numbers.format(1, config=config).startswith("RET")
    with pytest.raises(ValidationError):
        numbers.format(0, config=config)
    with pytest.raises(ValidationError):
        numbers.format(10**config.padding + 1, config=config)

    await _set_setting_raw(db_session, "returns.number.prefix", "BAD!")
    with pytest.raises(ValidationError):
        await numbers.load_config()
    await _set_setting_raw(db_session, "returns.number.prefix", "RET")

    await _set_setting_raw(db_session, "returns.number.separator", "*")
    with pytest.raises(ValidationError):
        await numbers.load_config()
    await _set_setting_raw(db_session, "returns.number.separator", "-")

    await _set_setting_raw(db_session, "returns.number.padding", "0")
    with pytest.raises(ValidationError):
        await numbers.load_config()
    await _set_setting_raw(db_session, "returns.number.padding", "8")

    assert ReturnNumberConfig(prefix="RET", separator="-", padding=8)

    req = ReturnCreateRequest(rental_id=uuid4(), notes="  n  ")
    assert req.notes == "n"

    with pytest.raises(ValidationError):
        await return_service.create(
            rental_id=active_rental.id,
            notes="ن" * 2001,
        )
    with pytest.raises(ValidationError):
        await return_service.create(
            rental_id=active_rental.id,
            returned_at=datetime(2026, 8, 2),
        )

    with pytest.raises(ValidationError):
        await return_service.list(sort_dir="sideways")
