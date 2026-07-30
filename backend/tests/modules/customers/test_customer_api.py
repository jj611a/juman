"""Customers API tests (v2)."""

import pytest
from app.modules.customers.constants import CustomerPermission
from app.modules.rbac.constants import SystemRoleName
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token


@pytest.mark.asyncio
async def test_list_requires_auth(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/customers")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_crud_flow(admin_client: AsyncClient) -> None:
    created = await admin_client.post(
        "/api/v1/customers",
        json={
            "full_name": "سارة حسن",
            "phone": "+9647701234567",
            "alternative_phone": "+9647711112222",
            "address": "البصرة",
            "national_id": "99887766",
            "notes": "ملاحظة",
            "gender": "FEMALE",
            "birth_date": "1995-03-10",
        },
    )
    assert created.status_code == 201, created.text
    customer_id = created.json()["data"]["id"]
    number = created.json()["data"]["customer_number"]
    assert number == "CUS-00000001"
    assert created.json()["data"]["full_name"] == "سارة حسن"
    assert created.json()["data"]["gender"] == "FEMALE"

    listed = await admin_client.get(
        "/api/v1/customers",
        params={"sort_by": "customer_number", "sort_dir": "asc"},
    )
    assert listed.status_code == 200
    assert listed.json()["meta"]["total"] >= 1

    searched = await admin_client.get("/api/v1/customers", params={"q": "سارة"})
    assert searched.status_code == 200
    assert searched.json()["meta"]["total"] >= 1

    by_number = await admin_client.get(f"/api/v1/customers/number/{number}")
    assert by_number.status_code == 200
    assert by_number.json()["data"]["id"] == customer_id

    got = await admin_client.get(f"/api/v1/customers/{customer_id}")
    assert got.status_code == 200

    patched = await admin_client.patch(
        f"/api/v1/customers/{customer_id}",
        json={"address": "نينوى", "clear_birth_date": True},
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["address"] == "نينوى"
    assert patched.json()["data"]["birth_date"] is None
    assert patched.json()["data"]["customer_number"] == number

    deactivated = await admin_client.post(f"/api/v1/customers/{customer_id}/deactivate")
    assert deactivated.status_code == 200
    assert deactivated.json()["data"]["is_active"] is False

    activated = await admin_client.post(f"/api/v1/customers/{customer_id}/activate")
    assert activated.status_code == 200
    assert activated.json()["data"]["is_active"] is True

    deleted = await admin_client.delete(f"/api/v1/customers/{customer_id}")
    assert deleted.status_code == 200
    missing = await admin_client.get(f"/api/v1/customers/{customer_id}")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_duplicate_phone_api(admin_client: AsyncClient) -> None:
    payload = {"full_name": "أول", "phone": "+9647710000001"}
    first = await admin_client.post("/api/v1/customers", json=payload)
    second = await admin_client.post(
        "/api/v1/customers",
        json={"full_name": "ثاني", "phone": "+9647710000001"},
    )
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["data"]["customer_number"] != second.json()["data"]["customer_number"]


@pytest.mark.asyncio
async def test_laundry_forbidden(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    _, pair = await create_user_with_token(
        db_session,
        username="customers_laundry",
        role_name=SystemRoleName.LAUNDRY.value,
    )
    response = await api_client.get(
        "/api/v1/customers",
        headers=bearer_headers(pair.access_token),
    )
    assert response.status_code == 403
    assert response.json()["error"]["details"]["required_permission"] == (
        CustomerPermission.VIEW.value
    )


@pytest.mark.asyncio
async def test_cashier_can_create(
    api_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    _, pair = await create_user_with_token(
        db_session,
        username="customers_cashier",
        role_name=SystemRoleName.CASHIER.value,
    )
    headers = bearer_headers(pair.access_token)
    listed = await api_client.get("/api/v1/customers", headers=headers)
    assert listed.status_code == 200
    created = await api_client.post(
        "/api/v1/customers",
        headers=headers,
        json={"full_name": "كاشير عميل", "phone": "+9647722223333"},
    )
    assert created.status_code == 201
    assert created.json()["data"]["customer_number"].startswith("CUS-")
