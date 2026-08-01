"""Settlement API and coverage tests."""

from datetime import timedelta
from uuid import uuid4

import pytest
from app.exceptions import NotFoundError, ValidationError
from app.modules.rbac.constants import SystemRoleName
from app.modules.settings.models.setting import Setting
from app.modules.settings.services.setting import SettingService
from app.modules.settlements.services.settlement import SettlementService
from app.modules.settlements.services.settlement_number import (
    SettlementNumberConfig,
    SettlementNumberService,
)
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token
from tests.modules.settlements.conftest import build_ready_rental, utc


async def _set_setting(session: AsyncSession, key: str, value: str) -> None:
    result = await session.execute(
        select(Setting).where(Setting.key == key, Setting.is_deleted.is_(False))
    )
    row = result.scalar_one()
    row.value = value
    await session.flush()


@pytest.mark.asyncio
async def test_settlement_api_flow(
    admin_client: AsyncClient,
    sample_customer,
    sample_dress,
) -> None:
    rental = await admin_client.post(
        "/api/v1/rentals",
        json={
            "customer_id": str(sample_customer.id),
            "rental_at": utc(2026, 8, 1).isoformat(),
            "expected_return_at": utc(2026, 8, 3).isoformat(),
            "initial_payment_type": "FIXED_AMOUNT",
            "initial_payment_value": 0,
            "items": [{"dress_id": str(sample_dress.id)}],
        },
    )
    assert rental.status_code == 201, rental.text
    rental_id = rental.json()["data"]["id"]

    ret = await admin_client.post(
        "/api/v1/returns",
        json={
            "rental_id": rental_id,
            "returned_at": utc(2026, 8, 3).isoformat(),
        },
    )
    assert ret.status_code == 201, ret.text
    return_id = ret.json()["data"]["id"]

    insp = await admin_client.post("/api/v1/inspections", json={"return_id": return_id})
    assert insp.status_code == 201, insp.text
    item_id = insp.json()["data"]["items"][0]["id"]
    done = await admin_client.patch(
        f"/api/v1/inspections/{insp.json()['data']['id']}",
        json={
            "items": [{"id": item_id, "condition": "GOOD", "requires_laundry": False}],
            "complete": True,
        },
    )
    assert done.status_code == 200, done.text

    created = await admin_client.post(
        "/api/v1/rental-settlements",
        json={"rental_id": rental_id},
    )
    assert created.status_code == 201, created.text
    body = created.json()["data"]
    stl_id = body["id"]

    by_rental = await admin_client.get(f"/api/v1/rentals/{rental_id}/settlement")
    assert by_rental.status_code == 200
    assert by_rental.json()["data"]["id"] == stl_id

    by_id = await admin_client.get(f"/api/v1/rental-settlements/{stl_id}")
    assert by_id.status_code == 200
    assert by_id.json()["data"]["settlement_number"].startswith("STL")

    bump = await admin_client.post(
        f"/api/v1/rental-settlements/{stl_id}/adjustments",
        json={"amount": 1_000, "reason": "رسوم إدارية"},
    )
    assert bump.status_code == 201, bump.text
    remaining = bump.json()["data"]["remaining_balance"]

    pay = await admin_client.post(
        f"/api/v1/rental-settlements/{stl_id}/payments",
        json={"amount": remaining, "payment_method": "CASH"},
    )
    assert pay.status_code == 201, pay.text
    assert pay.json()["data"]["status"] == "PAID"

    listed = await admin_client.get(
        "/api/v1/rental-settlements",
        params={"status": "PAID", "rental_id": rental_id},
    )
    assert listed.status_code == 200
    assert listed.json()["meta"]["total"] >= 1

    adj = await admin_client.post(
        f"/api/v1/rental-settlements/{stl_id}/adjustments",
        json={"amount": 1000, "reason": "بعد السداد"},
    )
    assert adj.status_code == 422


@pytest.mark.asyncio
async def test_settlement_authz(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    unauth = await api_client.get("/api/v1/rental-settlements")
    assert unauth.status_code == 401

    _, pair = await create_user_with_token(
        db_session,
        username="stl_laundry",
        role_name=SystemRoleName.LAUNDRY.value,
    )
    listed = await api_client.get(
        "/api/v1/rental-settlements",
        headers=bearer_headers(pair.access_token),
    )
    assert listed.status_code == 403


@pytest.mark.asyncio
async def test_number_service_and_coverage(
    db_session: AsyncSession,
    settlement_service: SettlementService,
    rental_service,
    return_service,
    inspection_service,
    sample_customer,
    sample_dress,
) -> None:
    numbers = SettlementNumberService(db_session, settings=SettingService(db_session))
    config = await numbers.load_config()
    assert numbers.format(1, config=config).startswith("STL")
    with pytest.raises(ValidationError):
        numbers.format(0, config=config)

    await _set_setting(db_session, "settlement.number.prefix", "BAD!")
    with pytest.raises(ValidationError):
        await numbers.load_config()
    await _set_setting(db_session, "settlement.number.prefix", "STL")
    await _set_setting(db_session, "settlement.number.separator", "*")
    with pytest.raises(ValidationError):
        await numbers.load_config()
    await _set_setting(db_session, "settlement.number.separator", "-")
    await _set_setting(db_session, "settlement.number.padding", "0")
    with pytest.raises(ValidationError):
        await numbers.load_config()
    await _set_setting(db_session, "settlement.number.padding", "8")
    assert SettlementNumberConfig(prefix="STL", separator="-", padding=8)

    rental = await build_ready_rental(
        rental_service=rental_service,
        return_service=return_service,
        inspection_service=inspection_service,
        customer=sample_customer,
        dresses=[sample_dress],
        rental_at=utc(2026, 11, 1),
        expected_return_at=utc(2026, 11, 2),
        returned_at=utc(2026, 11, 2) + timedelta(days=1),
        initial_payment_value=0,
    )
    stl = await settlement_service.create(rental_id=rental.id, notes="  ")
    assert "STL" in repr(stl)
    assert stl.late_penalty_amount == sample_dress.default_daily_rental_price

    rows, total = await settlement_service.list(rental_id=rental.id, sort_dir="asc")
    assert total == 1
    assert rows[0].id == stl.id

    with pytest.raises(ValidationError):
        await settlement_service.list(sort_by="nope")
    with pytest.raises(ValidationError):
        await settlement_service.add_payment(stl.id, amount=1, method="WIRE")
    with pytest.raises(NotFoundError):
        await settlement_service.get_by_rental(uuid4())
