"""Returns API tests."""

from uuid import uuid4

import pytest
from app.modules.rbac.constants import SystemRoleName
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token
from tests.modules.returns.conftest import utc


@pytest.mark.asyncio
async def test_return_api_flow(
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

    created = await admin_client.post(
        "/api/v1/returns",
        json={
            "rental_id": rental_id,
            "customer_id": str(sample_customer.id),
            "notes": "إرجاع API",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()["data"]
    assert body["status"] == "PENDING_INSPECTION"
    assert body["return_number"].startswith("RET")
    assert len(body["items"]) == 1
    ret_id = body["id"]

    listed = await admin_client.get(
        "/api/v1/returns",
        params={"status": "PENDING_INSPECTION", "rental_id": rental_id},
    )
    assert listed.status_code == 200
    assert listed.json()["meta"]["total"] >= 1

    got = await admin_client.get(f"/api/v1/returns/{ret_id}")
    assert got.status_code == 200
    assert got.json()["data"]["rental_id"] == rental_id

    rental_got = await admin_client.get(f"/api/v1/rentals/{rental_id}")
    assert rental_got.json()["data"]["status"] == "RETURN_PENDING"

    dup = await admin_client.post("/api/v1/returns", json={"rental_id": rental_id})
    assert dup.status_code == 409


@pytest.mark.asyncio
async def test_return_authz(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    unauth = await api_client.get("/api/v1/returns")
    assert unauth.status_code == 401

    _, pair = await create_user_with_token(
        db_session,
        username="ret_inventory",
        role_name=SystemRoleName.INVENTORY.value,
    )
    listed = await api_client.get(
        "/api/v1/returns",
        headers=bearer_headers(pair.access_token),
    )
    assert listed.status_code == 403

    missing = await api_client.get(
        f"/api/v1/returns/{uuid4()}",
        headers=bearer_headers(pair.access_token),
    )
    assert missing.status_code == 403
