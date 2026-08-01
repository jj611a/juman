"""Rentals API tests."""

from uuid import uuid4

import pytest
from app.modules.rbac.constants import SystemRoleName
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token
from tests.modules.rentals.conftest import utc


@pytest.mark.asyncio
async def test_rental_api_walk_in_flow(
    admin_client: AsyncClient,
    sample_customer,
    sample_dress,
) -> None:
    created = await admin_client.post(
        "/api/v1/rentals",
        json={
            "customer_id": str(sample_customer.id),
            "rental_at": utc(2026, 8, 1, 10).isoformat(),
            "expected_return_at": utc(2026, 8, 3, 10).isoformat(),
            "initial_payment_type": "FIXED_AMOUNT",
            "initial_payment_value": 50,
            "notes": "إيجار API",
            "items": [{"dress_id": str(sample_dress.id)}],
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()["data"]
    assert body["status"] == "ACTIVE"
    assert body["rental_number"].startswith("RENT")
    assert body["estimated_total"] == 200
    assert body["remaining_balance"] == 150
    rent_id = body["id"]

    listed = await admin_client.get("/api/v1/rentals", params={"status": "ACTIVE"})
    assert listed.status_code == 200
    assert listed.json()["meta"]["total"] >= 1

    got = await admin_client.get(f"/api/v1/rentals/{rent_id}")
    assert got.status_code == 200
    assert got.json()["data"]["items"][0]["calendar_block_id"] is not None

    patched = await admin_client.patch(
        f"/api/v1/rentals/{rent_id}",
        json={"notes": "معدل"},
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["notes"] == "معدل"

    cancelled = await admin_client.post(f"/api/v1/rentals/{rent_id}/cancel")
    assert cancelled.status_code == 422
    assert "لا يمكن إلغاء عملية التأجير بعد تسليم الفستان" in cancelled.text


@pytest.mark.asyncio
async def test_rental_api_from_reservation(
    admin_client: AsyncClient,
    sample_customer,
    sample_dress,
) -> None:
    draft = await admin_client.post(
        "/api/v1/reservations",
        json={
            "customer_id": str(sample_customer.id),
            "reservation_at": utc(2026, 7, 1).isoformat(),
            "rental_start_at": utc(2026, 9, 1).isoformat(),
            "expected_return_at": utc(2026, 9, 3).isoformat(),
            "items": [{"dress_id": str(sample_dress.id)}],
        },
    )
    assert draft.status_code == 201, draft.text
    rsv_id = draft.json()["data"]["id"]
    confirmed = await admin_client.post(f"/api/v1/reservations/{rsv_id}/confirm")
    assert confirmed.status_code == 200, confirmed.text

    rental = await admin_client.post(
        "/api/v1/rentals",
        json={
            "customer_id": str(sample_customer.id),
            "expected_return_at": utc(2026, 9, 3).isoformat(),
            "reservation_id": rsv_id,
            "initial_payment_type": "PERCENTAGE",
            "initial_payment_rate": 50,
        },
    )
    assert rental.status_code == 201, rental.text
    data = rental.json()["data"]
    assert data["reservation_id"] == rsv_id
    assert data["status"] == "ACTIVE"
    assert data["initial_payment_type"] == "PERCENTAGE"

    rsv = await admin_client.get(f"/api/v1/reservations/{rsv_id}")
    assert rsv.json()["data"]["status"] == "CONVERTED_TO_RENTAL"


@pytest.mark.asyncio
async def test_rental_authz(
    api_client: AsyncClient,
    sample_customer,
    sample_dress,
    db_session: AsyncSession,
) -> None:
    unauth = await api_client.get("/api/v1/rentals")
    assert unauth.status_code == 401

    _, pair = await create_user_with_token(
        db_session,
        username="rent_laundry",
        role_name=SystemRoleName.LAUNDRY.value,
    )
    listed = await api_client.get(
        "/api/v1/rentals",
        headers=bearer_headers(pair.access_token),
    )
    assert listed.status_code == 200  # laundry has rental.view

    create = await api_client.post(
        "/api/v1/rentals",
        headers=bearer_headers(pair.access_token),
        json={
            "customer_id": str(sample_customer.id),
            "expected_return_at": utc(2026, 8, 2).isoformat(),
            "rental_at": utc(2026, 8, 1).isoformat(),
            "initial_payment_type": "FIXED_AMOUNT",
            "initial_payment_value": 0,
            "items": [{"dress_id": str(sample_dress.id)}],
        },
    )
    assert create.status_code == 403

    missing = await api_client.get(
        f"/api/v1/rentals/{uuid4()}",
        headers=bearer_headers(pair.access_token),
    )
    assert missing.status_code == 404
