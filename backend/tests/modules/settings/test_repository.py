"""Repository-level tests for Settings."""

import pytest
from app.modules.settings.constants import SettingKey
from app.modules.settings.repositories.setting import SettingRepository
from sqlalchemy.ext.asyncio import AsyncSession
from tests.modules.settings.seed_helpers import apply_migration_settings_seed


@pytest.mark.asyncio
async def test_repository_get_by_key(db_session: AsyncSession) -> None:
    await apply_migration_settings_seed(db_session)
    await db_session.commit()

    repo = SettingRepository(db_session)
    setting = await repo.get_by_key(SettingKey.INVENTORY_BARCODE_PREFIX)
    assert setting is not None
    assert setting.value == "DR"


@pytest.mark.asyncio
async def test_repository_list_keys(db_session: AsyncSession) -> None:
    await apply_migration_settings_seed(db_session)
    await db_session.commit()

    repo = SettingRepository(db_session)
    keys = await repo.list_keys()
    assert SettingKey.DEFAULT_TIMEZONE in keys
    assert len(keys) == 55
