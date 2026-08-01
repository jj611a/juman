"""API tests for Settings endpoints."""

import pytest
from app.modules.settings.constants import SettingKey
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_settings_requires_auth(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/settings")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_settings(admin_client: AsyncClient) -> None:
    response = await admin_client.get("/api/v1/settings")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["total"] == 55
    keys = {item["key"] for item in body["items"]}
    assert SettingKey.CURRENCY in keys
    assert SettingKey.INVENTORY_BARCODE_PREFIX in keys
    assert SettingKey.MAX_FAILED_LOGIN_ATTEMPTS in keys
    assert SettingKey.MEDIA_STORAGE_PROVIDER in keys


@pytest.mark.asyncio
async def test_list_settings_by_category(admin_client: AsyncClient) -> None:
    response = await admin_client.get("/api/v1/settings", params={"category": "financial"})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 5
    assert all(item["category"] == "financial" for item in body["items"])
    keys = {item["key"] for item in body["items"]}
    assert SettingKey.SETTLEMENT_NUMBER_PREFIX in keys


@pytest.mark.asyncio
async def test_get_setting_by_key(admin_client: AsyncClient) -> None:
    response = await admin_client.get(f"/api/v1/settings/{SettingKey.CURRENCY}")
    assert response.status_code == 200
    body = response.json()
    assert body["item"]["key"] == SettingKey.CURRENCY
    assert body["item"]["parsed_value"] == "IQD"
    assert body["item"]["value_type"] == "string"


@pytest.mark.asyncio
async def test_get_setting_not_found(admin_client: AsyncClient) -> None:
    response = await admin_client.get("/api/v1/settings/does_not_exist")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


@pytest.mark.asyncio
async def test_put_update_setting(admin_client: AsyncClient) -> None:
    response = await admin_client.put(
        f"/api/v1/settings/{SettingKey.COMPANY_NAME}",
        json={"value": "جمان للأزياء", "description": "الاسم التجاري"},
    )
    assert response.status_code == 200
    item = response.json()["item"]
    assert item["parsed_value"] == "جمان للأزياء"
    assert item["description"] == "الاسم التجاري"


@pytest.mark.asyncio
async def test_patch_update_value(admin_client: AsyncClient) -> None:
    response = await admin_client.patch(
        f"/api/v1/settings/{SettingKey.MAXIMUM_INITIAL_PAYMENT_PERCENTAGE}/value",
        json={"value": 40},
    )
    assert response.status_code == 200
    assert response.json()["item"]["parsed_value"] == 40


@pytest.mark.asyncio
async def test_patch_rejects_invalid_percentage(admin_client: AsyncClient) -> None:
    response = await admin_client.patch(
        f"/api/v1/settings/{SettingKey.MAXIMUM_INITIAL_PAYMENT_PERCENTAGE}/value",
        json={"value": 200},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


@pytest.mark.asyncio
async def test_patch_boolean_setting(admin_client: AsyncClient) -> None:
    response = await admin_client.patch(
        f"/api/v1/settings/{SettingKey.ALLOW_MANUAL_SALE_PRICE_OVERRIDE}/value",
        json={"value": False},
    )
    assert response.status_code == 200
    assert response.json()["item"]["parsed_value"] is False
