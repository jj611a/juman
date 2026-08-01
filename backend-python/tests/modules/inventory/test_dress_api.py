"""Dresses API tests (Phase 1–2)."""

import pytest
from app.modules.inventory.constants import InventoryPermission
from app.modules.rbac.constants import SystemRoleName
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token


async def _ensure_category(admin_client: AsyncClient) -> str:
    response = await admin_client.post(
        "/api/v1/categories",
        json={"name_ar": "تصنيف فساتين", "name_en": "Dresses"},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]["id"]


def _dress_payload(category_id: str, **overrides):
    payload = {
        "category_id": category_id,
        "name_ar": "فستان سهرة",
        "name_en": "Evening Dress",
        "brand": "Juman",
        "size": "M",
        "colour": "BLACK",
        "purchase_price": 200_000,
        "default_daily_rental_price": 40_000,
        "default_sale_price": 280_000,
    }
    payload.update(overrides)
    return payload


@pytest.mark.asyncio
async def test_list_requires_auth(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/dresses")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_crud_flow_with_auto_barcode(admin_client: AsyncClient) -> None:
    category_id = await _ensure_category(admin_client)

    created = await admin_client.post(
        "/api/v1/dresses",
        json=_dress_payload(category_id),
    )
    assert created.status_code == 201, created.text
    dress_id = created.json()["data"]["id"]
    barcode = created.json()["data"]["barcode"]
    assert barcode == "DR-00000001"
    assert created.json()["data"]["status"] == "AVAILABLE"

    looked_up = await admin_client.get(f"/api/v1/dresses/barcode/{barcode}")
    assert looked_up.status_code == 200
    assert looked_up.json()["data"]["id"] == dress_id

    listed = await admin_client.get("/api/v1/dresses")
    assert listed.status_code == 200
    assert listed.json()["meta"]["total"] >= 1

    patched = await admin_client.patch(
        f"/api/v1/dresses/{dress_id}",
        json={"brand": "Juman Pro"},
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["brand"] == "Juman Pro"
    assert patched.json()["data"]["status"] == "AVAILABLE"
    assert patched.json()["data"]["barcode"] == barcode

    status_change = await admin_client.post(
        f"/api/v1/dresses/{dress_id}/status",
        json={"new_status": "RESERVED", "reason": "حجز تجريبي"},
    )
    assert status_change.status_code == 200
    assert status_change.json()["data"]["previous_status"] == "AVAILABLE"
    assert status_change.json()["data"]["new_status"] == "RESERVED"
    assert "RENTED" in status_change.json()["data"]["allowed_transitions"]

    barcode_patch = await admin_client.patch(
        f"/api/v1/dresses/{dress_id}/barcode",
        json={"barcode": "DR-00000100"},
    )
    assert barcode_patch.status_code == 200
    assert barcode_patch.json()["data"]["barcode"] == "DR-00000100"

    regenerated = await admin_client.patch(
        f"/api/v1/dresses/{dress_id}/barcode",
        json={},
    )
    assert regenerated.status_code == 200
    assert regenerated.json()["data"]["barcode"].startswith("DR-")

    deactivated = await admin_client.post(f"/api/v1/dresses/{dress_id}/deactivate")
    assert deactivated.status_code == 200

    activated = await admin_client.post(f"/api/v1/dresses/{dress_id}/activate")
    assert activated.status_code == 200

    deleted = await admin_client.delete(f"/api/v1/dresses/{dress_id}")
    assert deleted.status_code == 200
    missing = await admin_client.get(f"/api/v1/dresses/{dress_id}")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_manual_barcode_and_invalid_format(admin_client: AsyncClient) -> None:
    category_id = await _ensure_category(admin_client)
    ok = await admin_client.post(
        "/api/v1/dresses",
        json=_dress_payload(category_id, barcode="DR-00000005", name_ar="يدوي"),
    )
    assert ok.status_code == 201
    assert ok.json()["data"]["barcode"] == "DR-00000005"

    bad = await admin_client.post(
        "/api/v1/dresses",
        json=_dress_payload(category_id, barcode="BAD", name_ar="خاطئ"),
    )
    assert bad.status_code == 422 or bad.status_code == 400


@pytest.mark.asyncio
async def test_laundry_can_view_but_not_create(
    api_client: AsyncClient,
    db_session: AsyncSession,
    admin_client: AsyncClient,
) -> None:
    category_id = await _ensure_category(admin_client)
    _, pair = await create_user_with_token(
        db_session,
        username="inventory_laundry",
        role_name=SystemRoleName.LAUNDRY.value,
    )
    headers = bearer_headers(pair.access_token)
    listed = await api_client.get("/api/v1/dresses", headers=headers)
    assert listed.status_code == 200

    created = await api_client.post(
        "/api/v1/dresses",
        headers=headers,
        json=_dress_payload(category_id, name_ar="ممنوع"),
    )
    assert created.status_code == 403
    assert created.json()["error"]["details"]["required_permission"] == (
        InventoryPermission.CREATE.value
    )


@pytest.mark.asyncio
async def test_inventory_role_crud_but_not_barcode_change(
    api_client: AsyncClient,
    db_session: AsyncSession,
    admin_client: AsyncClient,
) -> None:
    category_id = await _ensure_category(admin_client)
    _, pair = await create_user_with_token(
        db_session,
        username="inventory_staff",
        role_name=SystemRoleName.INVENTORY.value,
    )
    headers = bearer_headers(pair.access_token)

    created = await api_client.post(
        "/api/v1/dresses",
        headers=headers,
        json=_dress_payload(category_id, name_ar="مخزون"),
    )
    assert created.status_code == 201, created.text
    dress_id = created.json()["data"]["id"]

    listed = await api_client.get("/api/v1/dresses", headers=headers)
    assert listed.status_code == 200

    patched = await api_client.patch(
        f"/api/v1/dresses/{dress_id}",
        headers=headers,
        json={"colour": "WHITE"},
    )
    assert patched.status_code == 200

    barcode_denied = await api_client.patch(
        f"/api/v1/dresses/{dress_id}/barcode",
        headers=headers,
        json={"barcode": "DR-00000077"},
    )
    assert barcode_denied.status_code == 403
    assert barcode_denied.json()["error"]["details"]["required_role"] == (
        SystemRoleName.ADMIN.value
    )

    deleted = await api_client.delete(f"/api/v1/dresses/{dress_id}", headers=headers)
    assert deleted.status_code == 200
