"""Sales API and coverage tests."""

from uuid import uuid4

import pytest
from app.exceptions import NotFoundError, ValidationError
from app.modules.rbac.constants import SystemRoleName
from app.modules.settings.services.setting import SettingService
from app.modules.sales.services.sale_number import SaleNumberConfig, SaleNumberService
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token
from tests.modules.sales.conftest import build_ruined_pending_context, normal_item, payment, utc


@pytest.mark.asyncio
async def test_sale_api_flow(
    admin_client: AsyncClient,
    sample_customer,
    sample_dress,
) -> None:
    created = await admin_client.post(
        "/api/v1/sales",
        json={
            "origin": "NORMAL_SALE",
            "customer_id": str(sample_customer.id),
            "items": [{"dress_id": str(sample_dress.id)}],
            "payment": {"amount": sample_dress.default_sale_price, "payment_method": "CASH"},
            "notes": "بيع عادي",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()["data"]
    sale_id = body["id"]
    assert body["sale_number"].startswith("SAL")
    assert body["status"] == "COMPLETED"
    assert body["total_amount"] == sample_dress.default_sale_price

    by_id = await admin_client.get(f"/api/v1/sales/{sale_id}")
    assert by_id.status_code == 200
    assert by_id.json()["data"]["id"] == sale_id

    listed = await admin_client.get(
        "/api/v1/sales",
        params={"customer_id": str(sample_customer.id), "status": "COMPLETED"},
    )
    assert listed.status_code == 200
    assert listed.json()["meta"]["total"] >= 1


@pytest.mark.asyncio
async def test_sale_authz(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    unauth = await api_client.get("/api/v1/sales")
    assert unauth.status_code == 401

    _, pair = await create_user_with_token(
        db_session,
        username="sal_laundry",
        role_name=SystemRoleName.LAUNDRY.value,
    )
    listed = await api_client.get(
        "/api/v1/sales",
        headers=bearer_headers(pair.access_token),
    )
    assert listed.status_code == 403


@pytest.mark.asyncio
async def test_mandatory_sale_api(
    admin_client: AsyncClient,
    rental_service,
    return_service,
    inspection_service,
    sample_customer,
    sample_dress,
) -> None:
    ctx = await build_ruined_pending_context(
        rental_service=rental_service,
        return_service=return_service,
        inspection_service=inspection_service,
        customer=sample_customer,
        dress=sample_dress,
        rental_at=utc(2026, 8, 1, 10),
        expected_return_at=utc(2026, 8, 2, 10),
        returned_at=utc(2026, 8, 2, 10),
    )
    created = await admin_client.post(
        "/api/v1/sales",
        json={
            "origin": "MANDATORY_DAMAGE_PURCHASE",
            "customer_id": str(sample_customer.id),
            "inspection_item_id": str(ctx["inspection_item"].id),
            "items": [{"dress_id": str(sample_dress.id)}],
            "payment": {"amount": sample_dress.default_sale_price, "payment_method": "CARD"},
        },
    )
    assert created.status_code == 201, created.text
    data = created.json()["data"]
    assert data["origin"] == "MANDATORY_DAMAGE_PURCHASE"
    assert data["inspection_id"] == str(ctx["inspection"].id)


@pytest.mark.asyncio
async def test_number_service_config_validation(db_session: AsyncSession) -> None:
    from app.modules.settings.models.setting import Setting
    from sqlalchemy import select
    from tests.helpers.identity import seed_identity_basics

    await seed_identity_basics(db_session)
    numbers = SaleNumberService(db_session, settings=SettingService(db_session))
    config = await numbers.load_config()
    assert numbers.format(1, config=config).startswith("SAL")
    with pytest.raises(ValidationError):
        numbers.format(0, config=config)

    async def _set_setting(key: str, value: str) -> None:
        result = await db_session.execute(
            select(Setting).where(Setting.key == key, Setting.is_deleted.is_(False))
        )
        row = result.scalar_one()
        row.value = value
        await db_session.flush()

    await _set_setting("sale.number.prefix", "BAD!")
    with pytest.raises(ValidationError):
        await numbers.load_config()
    await _set_setting("sale.number.prefix", "SAL")
    await _set_setting("sale.number.separator", "*")
    with pytest.raises(ValidationError):
        await numbers.load_config()
    await _set_setting("sale.number.separator", "-")
    await _set_setting("sale.number.padding", "0")
    with pytest.raises(ValidationError):
        await numbers.load_config()
    assert SaleNumberConfig(prefix="SAL", separator="-", padding=8)

    with pytest.raises(ValidationError):
        numbers.format(10**9, config=SaleNumberConfig(prefix="SAL", separator="-", padding=4))


@pytest.mark.asyncio
async def test_sale_api_validation(
    admin_client: AsyncClient,
    sample_dress,
) -> None:
    bad = await admin_client.post(
        "/api/v1/sales",
        json={
            "origin": "NORMAL_SALE",
            "items": [{"dress_id": str(sample_dress.id)}],
            "payment": {"amount": 0, "payment_method": "CASH"},
        },
    )
    assert bad.status_code == 422

    listed = await admin_client.get(
        "/api/v1/sales",
        params={"origin": "NORMAL_SALE", "sort_by": "sale_number", "sort_dir": "asc"},
    )
    assert listed.status_code == 200


@pytest.mark.asyncio
async def test_number_service_and_router_coverage(
    sale_service,
    sample_dress,
) -> None:
    sale = await sale_service.create(
        origin="NORMAL_SALE",
        items=[normal_item(sample_dress.id)],
        payment=payment(sample_dress.default_sale_price),
    )
    assert "SAL" in repr(sale)

    with pytest.raises(NotFoundError):
        await sale_service.get(uuid4())


def test_sale_schema_validators() -> None:
    from app.modules.sales.schemas.sale import (
        SaleCreateRequest,
        SaleItemCreateRequest,
        SaleItemResponse,
        SaleListResponse,
        SalePaymentCreateRequest,
        SalePaymentResponse,
        SaleResponse,
    )

    item = SaleItemCreateRequest(dress_id=uuid4(), notes="  note  ")
    assert item.notes == "note"

    pay = SalePaymentCreateRequest(
        amount=100,
        payment_method="CASH",
        reference_number="  ref  ",
        notes="  ",
    )
    assert pay.reference_number == "ref"
    assert pay.notes is None

    with pytest.raises(ValueError):
        SaleCreateRequest(
            origin="MANDATORY_DAMAGE_PURCHASE",
            items=[SaleItemCreateRequest(dress_id=uuid4())],
            payment=pay,
        )


@pytest.mark.asyncio
async def test_sale_repository_helpers(db_session: AsyncSession) -> None:
    from tests.helpers.identity import seed_identity_basics

    from app.modules.sales.repositories.sale import (
        SaleItemRepository,
        SalePaymentRepository,
        SaleRepository,
    )

    await seed_identity_basics(db_session)
    repo = SaleRepository(db_session)
    items = SaleItemRepository(db_session)
    pays = SalePaymentRepository(db_session)

    assert await repo.get_by_sale_number("SAL-00000099") is None
    rows = await repo.list_filtered(status="COMPLETED", origin="NORMAL_SALE", limit=5)
    assert rows == []
    assert await repo.count_filtered(status="COMPLETED") == 0
    assert await items.get_by_inspection_item_id(uuid4()) is None
    assert await items.list_for_sale(uuid4()) == []
    assert await pays.list_for_sale(uuid4()) == []
