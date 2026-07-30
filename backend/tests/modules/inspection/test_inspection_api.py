"""Inspection API tests."""

from uuid import uuid4

import pytest
from app.modules.rbac.constants import SystemRoleName
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token
from tests.modules.inspection.conftest import utc


@pytest.mark.asyncio
async def test_inspection_api_flow(
    admin_client: AsyncClient,
    sample_customer,
    sample_dress,
) -> None:
    rental = await admin_client.post(
        "/api/v1/rentals",
        json={
            "customer_id": str(sample_customer.id),
            "rental_at": utc(2026, 8, 1).isoformat(),
            "expected_return_at": utc(2026, 8, 2).isoformat(),
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

    created = await admin_client.post(
        "/api/v1/inspections",
        json={"return_id": return_id, "notes": "فحص API"},
    )
    assert created.status_code == 201, created.text
    body = created.json()["data"]
    assert body["status"] == "PENDING"
    assert body["inspection_number"].startswith("INS")
    item_id = body["items"][0]["id"]
    insp_id = body["id"]

    completed = await admin_client.patch(
        f"/api/v1/inspections/{insp_id}",
        json={
            "items": [
                {
                    "id": item_id,
                    "condition": "GOOD",
                    "requires_laundry": False,
                }
            ],
            "complete": True,
        },
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["data"]["status"] == "COMPLETED"

    listed = await admin_client.get(
        "/api/v1/inspections",
        params={"status": "COMPLETED", "return_id": return_id},
    )
    assert listed.status_code == 200
    assert listed.json()["meta"]["total"] >= 1

    got = await admin_client.get(f"/api/v1/inspections/{insp_id}")
    assert got.status_code == 200
    assert got.json()["data"]["id"] == insp_id

    ret_got = await admin_client.get(f"/api/v1/returns/{return_id}")
    assert ret_got.json()["data"]["status"] == "INSPECTION_COMPLETED"

    dup = await admin_client.post("/api/v1/inspections", json={"return_id": return_id})
    assert dup.status_code == 409


@pytest.mark.asyncio
async def test_inspection_authz(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    unauth = await api_client.get("/api/v1/inspections")
    assert unauth.status_code == 401

    _, pair = await create_user_with_token(
        db_session,
        username="insp_cashier",
        role_name=SystemRoleName.CASHIER.value,
    )
    listed = await api_client.get(
        "/api/v1/inspections",
        headers=bearer_headers(pair.access_token),
    )
    assert listed.status_code == 403

    missing = await api_client.get(
        f"/api/v1/inspections/{uuid4()}",
        headers=bearer_headers(pair.access_token),
    )
    assert missing.status_code == 403
