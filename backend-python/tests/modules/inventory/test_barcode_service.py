"""BarcodeService tests."""

import pytest
from app.exceptions import ConflictError, ValidationError
from app.modules.inventory.services.barcode import BarcodeService
from app.modules.inventory.services.dress import DressService


@pytest.mark.asyncio
async def test_sequential_generation(barcode_service: BarcodeService) -> None:
    first = await barcode_service.generate_next()
    second = await barcode_service.generate_next()
    third = await barcode_service.generate_next()
    assert first == "DR-00000001"
    assert second == "DR-00000002"
    assert third == "DR-00000003"


@pytest.mark.asyncio
async def test_format_parse_validate(
    barcode_service: BarcodeService,
) -> None:
    config = await barcode_service.load_config()
    formatted = barcode_service.format(42, config=config)
    assert formatted == "DR-00000042"
    parsed = barcode_service.parse(formatted, config=config)
    assert parsed.sequence == 42
    assert parsed.prefix == "DR"

    with pytest.raises(ValidationError):
        barcode_service.parse("XX-00000001", config=config)
    with pytest.raises(ValidationError):
        barcode_service.parse("DR-1", config=config)
    with pytest.raises(ValidationError):
        barcode_service.parse("DR-0000000A", config=config)


@pytest.mark.asyncio
async def test_validate_rejects_duplicate_including_soft_deleted(
    dress_service: DressService,
    barcode_service: BarcodeService,
    sample_category,
) -> None:
    dress = await dress_service.create_dress(
        category_id=sample_category.id,
        name_ar="أصل",
        size="M",
        colour="RED",
        purchase_price=1,
        default_daily_rental_price=1,
        default_sale_price=1,
        barcode="DR-00000010",
    )
    await dress_service.soft_delete(dress.id)

    with pytest.raises(ConflictError):
        await barcode_service.validate("DR-00000010")


@pytest.mark.asyncio
async def test_generate_skips_manual_collision(
    dress_service: DressService,
    barcode_service: BarcodeService,
    sample_category,
) -> None:
    await dress_service.create_dress(
        category_id=sample_category.id,
        name_ar="يدوي",
        size="M",
        colour="BLACK",
        purchase_price=1,
        default_daily_rental_price=1,
        default_sale_price=1,
        barcode="DR-00000001",
    )
    # Counter was bumped to 1 by manual create; next generate should be 2.
    nxt = await barcode_service.generate_next()
    assert nxt == "DR-00000002"


@pytest.mark.asyncio
async def test_format_edge_cases(barcode_service: BarcodeService) -> None:
    config = await barcode_service.load_config()
    with pytest.raises(ValidationError):
        barcode_service.format(0, config=config)
    with pytest.raises(ValidationError):
        barcode_service.format(10**9, config=config)
    assert await barcode_service.format_sequence(7) == "DR-00000007"
    with pytest.raises(ValidationError):
        barcode_service.parse("   ", config=config)


@pytest.mark.asyncio
async def test_exists_and_validate_without_unique_check(
    barcode_service: BarcodeService,
) -> None:
    assert await barcode_service.exists("DR-00000001") is False
    value = await barcode_service.validate("DR-00000003", check_unique=False)
    assert value == "DR-00000003"


@pytest.mark.asyncio
async def test_bump_counter_ignores_invalid(
    barcode_service: BarcodeService,
) -> None:
    await barcode_service.bump_counter_if_needed("NOT-A-BARCODE")


@pytest.mark.asyncio
async def test_load_config_rejects_bad_settings(
    barcode_service: BarcodeService,
    db_session,
) -> None:
    from app.modules.settings.constants import SettingKey
    from app.modules.settings.services.setting import SettingService

    settings = SettingService(db_session)
    await settings.update_value(SettingKey.INVENTORY_BARCODE_PREFIX.value, "bad-prefix!")
    with pytest.raises(ValidationError):
        await barcode_service.load_config()


@pytest.mark.asyncio
async def test_generate_exhausts_space(
    barcode_service: BarcodeService,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.modules.inventory.services.barcode import BarcodeFormatConfig

    async def _cfg():
        return BarcodeFormatConfig(prefix="DR", separator="-", padding=1)

    async def _exists(_barcode, **_kwargs):
        return True

    monkeypatch.setattr(barcode_service, "load_config", _cfg)
    monkeypatch.setattr(barcode_service, "exists", _exists)
    with pytest.raises(ValidationError):
        await barcode_service.generate_next()


@pytest.mark.asyncio
async def test_concurrency_sequential_sessions(db_session) -> None:
    """Two services sharing a session still allocate distinct barcodes."""
    from app.modules.settings.services.setting import SettingService
    from tests.helpers.identity import seed_identity_basics

    await seed_identity_basics(db_session)
    settings = SettingService(db_session)
    a = BarcodeService(db_session, settings=settings)
    b = BarcodeService(db_session, settings=settings)
    first = await a.generate_next()
    second = await b.generate_next()
    assert first != second
    assert {first, second} == {"DR-00000001", "DR-00000002"}
