"""CustomerNumberService tests."""

import pytest
from app.exceptions import ConflictError, ValidationError
from app.modules.customers.services.customer import CustomerService
from app.modules.customers.services.customer_number import (
    CustomerNumberConfig,
    CustomerNumberService,
)
from app.modules.settings.services.setting import SettingService
from tests.helpers.identity import seed_identity_basics


@pytest.mark.asyncio
async def test_sequential_numbers(customer_service: CustomerService) -> None:
    a = await customer_service.create_customer(full_name="أ", phone="+9647701000001")
    b = await customer_service.create_customer(full_name="ب", phone="+9647701000002")
    assert a.customer_number == "CUS-00000001"
    assert b.customer_number == "CUS-00000002"


@pytest.mark.asyncio
async def test_format_and_config_errors(db_session) -> None:
    await seed_identity_basics(db_session)
    service = CustomerNumberService(db_session, settings=SettingService(db_session))
    config = await service.load_config()
    assert service.format(5, config=config) == "CUS-00000005"
    with pytest.raises(ValidationError):
        service.format(0, config=config)
    with pytest.raises(ValidationError):
        service.format(10**9, config=config)


@pytest.mark.asyncio
async def test_ensure_unique_and_exhaust(
    customer_service: CustomerService,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    created = await customer_service.create_customer(
        full_name="وحيد",
        phone="+9647701000099",
    )
    with pytest.raises(ConflictError):
        await customer_service.numbers.ensure_unique(created.customer_number)

    async def _cfg():
        return CustomerNumberConfig(prefix="CUS", separator="-", padding=1)

    async def _exists(_number, **_kwargs):
        return True

    monkeypatch.setattr(customer_service.numbers, "load_config", _cfg)
    monkeypatch.setattr(customer_service.numbers, "exists", _exists)
    with pytest.raises(ValidationError):
        await customer_service.numbers.generate_next()


@pytest.mark.asyncio
async def test_load_config_rejects_bad_prefix(db_session) -> None:
    from app.modules.settings.constants import SettingKey

    await seed_identity_basics(db_session)
    settings = SettingService(db_session)
    service = CustomerNumberService(db_session, settings=settings)
    await settings.update_value(SettingKey.CUSTOMERS_NUMBER_PREFIX.value, "bad!")
    with pytest.raises(ValidationError):
        await service.load_config()
