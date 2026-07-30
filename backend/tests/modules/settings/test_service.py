"""Service-layer tests for Settings (SQLite-backed)."""

import pytest
from app.exceptions import BusinessError, NotFoundError, ValidationError
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService


@pytest.mark.asyncio
async def test_migrated_settings_are_readable(setting_service: SettingService) -> None:
    items = await setting_service.list_settings()
    assert len(items) == 55


@pytest.mark.asyncio
async def test_typed_getters(setting_service: SettingService) -> None:
    assert await setting_service.get_string(SettingKey.CURRENCY) == "IQD"
    assert await setting_service.get_int(SettingKey.MAXIMUM_INITIAL_PAYMENT_PERCENTAGE) == 50
    assert await setting_service.get_bool(SettingKey.ALLOW_MANUAL_SALE_PRICE_OVERRIDE) is True
    assert await setting_service.get_string(SettingKey.DEFAULT_TIMEZONE) == "Asia/Baghdad"


@pytest.mark.asyncio
async def test_get_by_key_not_found(setting_service: SettingService) -> None:
    with pytest.raises(NotFoundError):
        await setting_service.get_by_key("missing_key")


@pytest.mark.asyncio
async def test_update_value_and_read_back(setting_service: SettingService) -> None:
    updated = await setting_service.update_value(
        SettingKey.MAXIMUM_INITIAL_PAYMENT_PERCENTAGE,
        75,
    )
    assert updated.value == "75"
    assert await setting_service.get_int(SettingKey.MAXIMUM_INITIAL_PAYMENT_PERCENTAGE) == 75


@pytest.mark.asyncio
async def test_update_rejects_invalid_percentage(setting_service: SettingService) -> None:
    with pytest.raises(ValidationError):
        await setting_service.update_value(
            SettingKey.MAXIMUM_INITIAL_PAYMENT_PERCENTAGE,
            150,
        )


@pytest.mark.asyncio
async def test_update_setting_with_description(setting_service: SettingService) -> None:
    updated = await setting_service.update_setting(
        SettingKey.COMPANY_PHONE,
        value="07801234567",
        description="هاتف المبيعات",
    )
    assert updated.value == "07801234567"
    assert updated.description == "هاتف المبيعات"


@pytest.mark.asyncio
async def test_non_editable_setting_rejected(
    setting_service: SettingService,
    db_session,
) -> None:
    setting = await setting_service.get_by_key(SettingKey.CURRENCY)
    setting.is_editable = False
    await db_session.flush()

    with pytest.raises(BusinessError) as exc_info:
        await setting_service.update_value(SettingKey.CURRENCY, "USD")
    assert exc_info.value.code == "setting_not_editable"


@pytest.mark.asyncio
async def test_list_filter_by_category(setting_service: SettingService) -> None:
    company = await setting_service.list_settings(category="company")
    assert len(company) == 4
    assert all(item.category == "company" for item in company)


@pytest.mark.asyncio
async def test_get_int_on_string_raises(setting_service: SettingService) -> None:
    with pytest.raises(BusinessError):
        await setting_service.get_int(SettingKey.CURRENCY)


@pytest.mark.asyncio
async def test_service_has_no_ensure_defaults() -> None:
    """Application services must not reseed defaults (Alembic owns seeding)."""
    assert not hasattr(SettingService, "ensure_defaults")
