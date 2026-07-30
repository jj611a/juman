"""Tests that Settings seed catalog lives only in the Alembic migration."""

import pytest
from app.modules.settings.constants import SettingKey
from tests.modules.settings.seed_helpers import (
    apply_migration_settings_seed,
    load_settings_migration_seeds,
)


def test_migration_seeds_cover_required_business_keys() -> None:
    seeds = load_settings_migration_seeds()
    keys = {seed["key"] for seed in seeds}
    required = {
        SettingKey.COMPANY_NAME,
        SettingKey.COMPANY_PHONE,
        SettingKey.COMPANY_ADDRESS,
        SettingKey.COMPANY_LOGO,
        SettingKey.CURRENCY,
        SettingKey.MAXIMUM_INITIAL_PAYMENT_PERCENTAGE,
        SettingKey.MANDATORY_PROCESSING_DAYS,
        SettingKey.OPTIONAL_PROCESSING_DAYS,
        SettingKey.INVENTORY_BARCODE_PREFIX,
        SettingKey.INVENTORY_BARCODE_SEPARATOR,
        SettingKey.INVENTORY_BARCODE_PADDING,
        SettingKey.ALLOW_MANUAL_SALE_PRICE_OVERRIDE,
        SettingKey.ALLOW_MANUAL_RENTAL_PRICE_OVERRIDE,
        SettingKey.RESERVATION_CONFLICT_COMPENSATION_ENABLED,
        SettingKey.DEFAULT_TIMEZONE,
    }
    assert required.issubset(keys)
    assert len(seeds) == 15


def test_migration_seeded_currency_is_iqd() -> None:
    seeds = load_settings_migration_seeds()
    currency = next(s for s in seeds if s["key"] == SettingKey.CURRENCY)
    assert currency["value"] == "IQD"


def test_migration_seeded_payment_percentage_is_fifty() -> None:
    seeds = load_settings_migration_seeds()
    setting = next(s for s in seeds if s["key"] == SettingKey.MAXIMUM_INITIAL_PAYMENT_PERCENTAGE)
    assert setting["value"] == 50


def test_migration_seeded_barcode_defaults() -> None:
    seeds = load_settings_migration_seeds()
    prefix = next(s for s in seeds if s["key"] == SettingKey.INVENTORY_BARCODE_PREFIX)
    separator = next(s for s in seeds if s["key"] == SettingKey.INVENTORY_BARCODE_SEPARATOR)
    padding = next(s for s in seeds if s["key"] == SettingKey.INVENTORY_BARCODE_PADDING)
    assert prefix["value"] == "DR"
    assert separator["value"] == "-"
    assert padding["value"] == 8


def test_identity_migration_seeds_security_keys() -> None:
    from tests.modules.settings.seed_helpers import load_identity_settings_seeds

    seeds = load_identity_settings_seeds()
    keys = {seed["key"] for seed in seeds}
    assert SettingKey.MAX_FAILED_LOGIN_ATTEMPTS in keys
    assert SettingKey.PASSWORD_MIN_LENGTH in keys
    assert len(seeds) == 7


@pytest.mark.asyncio
async def test_migration_seed_helper_is_idempotent(db_session) -> None:
    """Applying migration seeds twice must not create duplicates."""
    first = await apply_migration_settings_seed(db_session)
    second = await apply_migration_settings_seed(db_session)
    assert first == 55  # +2 backup settings
    assert second == 0
