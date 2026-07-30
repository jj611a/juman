"""Processing API tests."""

from uuid import uuid4

import pytest
from app.modules.rbac.constants import SystemRoleName
from app.modules.settings.models.setting import Setting
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token
from tests.modules.processing.conftest import utc


async def _set_mandatory_days(session: AsyncSession, value: int) -> None:
    result = await session.execute(
        select(Setting).where(
            Setting.key == "mandatory_processing_days",
            Setting.is_deleted.is_(False),
        )
    )
    row = result.scalar_one()
    row.value = str(value)
    await session.flush()


@pytest.mark.asyncio
async def test_processing_api_flow(
    admin_client: AsyncClient,
    db_session: AsyncSession,
    sample_customer,
    sample_dress,
) -> None:
    await _set_mandatory_days(db_session, 0)

    rental = await admin_client.post(
        "/api/v1/rentals",
        json={
            "customer_id": str(sample_customer.id),
            "rental_at": utc(2026, 8, 1).isoformat(),
            "expected_return_at": utc(2026, 8, 8).isoformat(),
            "initial_payment_type": "FIXED_AMOUNT",
            "initial_payment_value": 0,
            "items": [{"dress_id": str(sample_dress.id)}],
        },
    )
    assert rental.status_code == 201, rental.text
    rental_id = rental.json()["data"]["id"]

    ret = await admin_client.post("/api/v1/returns", json={"rental_id": rental_id})
    assert ret.status_code == 201, ret.text
    return_id = ret.json()["data"]["id"]

    insp = await admin_client.post(
        "/api/v1/inspections",
        json={"return_id": return_id},
    )
    assert insp.status_code == 201, insp.text
    insp_body = insp.json()["data"]
    item_id = insp_body["items"][0]["id"]

    completed_insp = await admin_client.patch(
        f"/api/v1/inspections/{insp_body['id']}",
        json={
            "items": [
                {
                    "id": item_id,
                    "condition": "MINOR_DAMAGE",
                    "repair_penalty_amount": 1000,
                    "requires_laundry": True,
                }
            ],
            "complete": True,
        },
    )
    assert completed_insp.status_code == 200, completed_insp.text
    insp_item_id = completed_insp.json()["data"]["items"][0]["id"]

    created = await admin_client.post(
        "/api/v1/processing",
        json={
            "inspection_item_ids": [insp_item_id],
            "notes": "API",
            "enable_optional_day": True,
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()["data"]
    assert body["status"] == "PENDING"
    batch_id = body["id"]

    started = await admin_client.post(f"/api/v1/processing/{batch_id}/start", json={})
    assert started.status_code == 200, started.text
    assert started.json()["data"]["status"] == "IN_PROCESS"
    assert started.json()["data"]["optional_extra_day_enabled"] is True

    got = await admin_client.get(f"/api/v1/processing/{batch_id}")
    assert got.status_code == 200

    listed = await admin_client.get(
        "/api/v1/processing",
        params={"status": "IN_PROCESS", "dress_id": str(sample_dress.id)},
    )
    assert listed.status_code == 200
    assert listed.json()["meta"]["total"] >= 1

    patched = await admin_client.patch(
        f"/api/v1/processing/{batch_id}",
        json={"notes": "ملاحظات"},
    )
    assert patched.status_code == 200

    completed = await admin_client.post(f"/api/v1/processing/{batch_id}/complete")
    assert completed.status_code == 200, completed.text
    assert completed.json()["data"]["status"] == "COMPLETED"


@pytest.mark.asyncio
async def test_processing_authz(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    unauth = await api_client.get("/api/v1/processing")
    assert unauth.status_code == 401

    _, pair = await create_user_with_token(
        db_session,
        username="proc_cashier",
        role_name=SystemRoleName.CASHIER.value,
    )
    listed = await api_client.get(
        "/api/v1/processing",
        headers=bearer_headers(pair.access_token),
    )
    assert listed.status_code == 403

    missing = await api_client.get(
        f"/api/v1/processing/{uuid4()}",
        headers=bearer_headers(pair.access_token),
    )
    assert missing.status_code == 403
