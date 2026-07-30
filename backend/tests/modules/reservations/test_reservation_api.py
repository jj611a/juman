"""Reservations API tests."""

from uuid import uuid4

import pytest
from app.modules.rbac.constants import SystemRoleName
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token
from tests.modules.reservations.conftest import utc


@pytest.mark.asyncio
async def test_reservation_api_flow(
    admin_client: AsyncClient,
    sample_customer,
    sample_dress,
) -> None:
    created = await admin_client.post(
        "/api/v1/reservations",
        json={
            "customer_id": str(sample_customer.id),
            "reservation_at": utc(2026, 7, 1).isoformat(),
            "rental_start_at": utc(2026, 8, 20, 10).isoformat(),
            "expected_return_at": utc(2026, 8, 22, 10).isoformat(),
            "notes": "حجز API",
            "items": [{"dress_id": str(sample_dress.id)}],
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()["data"]
    assert body["status"] == "DRAFT"
    rsv_id = body["id"]

    listed = await admin_client.get("/api/v1/reservations", params={"status": "DRAFT"})
    assert listed.status_code == 200
    assert listed.json()["meta"]["total"] >= 1

    got = await admin_client.get(f"/api/v1/reservations/{rsv_id}")
    assert got.status_code == 200
    assert got.json()["data"]["reservation_number"].startswith("RSV")

    patched = await admin_client.patch(
        f"/api/v1/reservations/{rsv_id}",
        json={"notes": "معدّل"},
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["notes"] == "معدّل"

    confirmed = await admin_client.post(f"/api/v1/reservations/{rsv_id}/confirm")
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["data"]["status"] == "CONFIRMED"
    assert confirmed.json()["data"]["items"][0]["calendar_block_id"] is not None

    cancelled = await admin_client.post(f"/api/v1/reservations/{rsv_id}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["data"]["status"] == "CANCELLED"


@pytest.mark.asyncio
async def test_reservation_expire_and_overlap_api(
    admin_client: AsyncClient,
    sample_customer,
    sample_dress,
) -> None:
    first = await admin_client.post(
        "/api/v1/reservations",
        json={
            "customer_id": str(sample_customer.id),
            "reservation_at": utc(2026, 7, 1).isoformat(),
            "rental_start_at": utc(2026, 12, 1).isoformat(),
            "expected_return_at": utc(2026, 12, 3).isoformat(),
            "items": [{"dress_id": str(sample_dress.id)}],
        },
    )
    first_id = first.json()["data"]["id"]
    assert (await admin_client.post(f"/api/v1/reservations/{first_id}/confirm")).status_code == 200

    second = await admin_client.post(
        "/api/v1/reservations",
        json={
            "customer_id": str(sample_customer.id),
            "reservation_at": utc(2026, 7, 2).isoformat(),
            "rental_start_at": utc(2026, 12, 2).isoformat(),
            "expected_return_at": utc(2026, 12, 4).isoformat(),
            "items": [{"dress_id": str(sample_dress.id)}],
        },
    )
    second_id = second.json()["data"]["id"]
    overlap = await admin_client.post(f"/api/v1/reservations/{second_id}/confirm")
    assert overlap.status_code == 409

    expired = await admin_client.post(f"/api/v1/reservations/{first_id}/expire")
    assert expired.status_code == 200
    assert expired.json()["data"]["status"] == "EXPIRED"


@pytest.mark.asyncio
async def test_reservation_authz(
    api_client: AsyncClient,
    sample_customer,
    sample_dress,
    db_session: AsyncSession,
) -> None:
    unauth = await api_client.get("/api/v1/reservations")
    assert unauth.status_code == 401

    _, pair = await create_user_with_token(
        db_session,
        username="rsv_laundry",
        role_name=SystemRoleName.LAUNDRY.value,
    )
    listed = await api_client.get(
        "/api/v1/reservations",
        headers=bearer_headers(pair.access_token),
    )
    assert listed.status_code == 403

    create = await api_client.post(
        "/api/v1/reservations",
        headers=bearer_headers(pair.access_token),
        json={
            "customer_id": str(sample_customer.id),
            "reservation_at": utc(2026, 7, 1).isoformat(),
            "rental_start_at": utc(2026, 8, 1).isoformat(),
            "expected_return_at": utc(2026, 8, 2).isoformat(),
            "items": [{"dress_id": str(sample_dress.id)}],
        },
    )
    assert create.status_code == 403

    missing = await api_client.get(
        f"/api/v1/reservations/{uuid4()}",
        headers=bearer_headers(pair.access_token),
    )
    assert missing.status_code == 403
