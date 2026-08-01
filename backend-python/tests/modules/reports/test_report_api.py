"""API authorization and smoke tests for Reports."""

from datetime import date

import pytest
from app.modules.rbac.constants import SystemRoleName
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.auth import bearer_headers, create_user_with_token
from tests.modules.reports.conftest import insert_completed_sale, utc


@pytest.mark.asyncio
async def test_dashboard_requires_auth(api_client: AsyncClient):
    response = await api_client.get("/api/v1/reports/dashboard")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_dashboard_ok_admin(admin_client: AsyncClient):
    response = await admin_client.get("/api/v1/reports/dashboard")
    assert response.status_code == 200
    body = response.json()
    assert "dresses_by_status" in body
    assert "sale_revenue" not in body


@pytest.mark.asyncio
async def test_laundry_forbidden(api_client: AsyncClient, db_session: AsyncSession):
    _, pair = await create_user_with_token(
        db_session, username="rpt_laundry", role_name=SystemRoleName.LAUNDRY.value
    )
    response = await api_client.get(
        "/api/v1/reports/dashboard",
        headers=bearer_headers(pair.access_token),
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_inventory_role_cannot_access_financial(
    api_client: AsyncClient, db_session: AsyncSession
):
    _, pair = await create_user_with_token(
        db_session, username="rpt_inv", role_name=SystemRoleName.INVENTORY.value
    )
    headers = bearer_headers(pair.access_token)
    ok = await api_client.get("/api/v1/reports/inventory/summary", headers=headers)
    assert ok.status_code == 200
    denied = await api_client.get(
        "/api/v1/reports/financial/summary",
        headers=headers,
        params={"date_from": "2026-07-01", "date_to": "2026-07-10"},
    )
    assert denied.status_code == 403
    sales = await api_client.get(
        "/api/v1/reports/sales/summary",
        headers=headers,
        params={"date_from": "2026-07-01", "date_to": "2026-07-10"},
    )
    assert sales.status_code == 403


@pytest.mark.asyncio
async def test_financial_summary_admin(
    admin_client: AsyncClient,
    sample_dress,
    sample_customer,
    db_session: AsyncSession,
):
    await insert_completed_sale(
        db_session,
        dress=sample_dress,
        amount=123000,
        sold_at=utc(2026, 7, 3, 9),
        customer_id=sample_customer.id,
    )
    response = await admin_client.get(
        "/api/v1/reports/financial/summary",
        params={"date_from": "2026-07-01", "date_to": "2026-07-10"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["sale_revenue"] == 123000
    assert body["total_cash_collected"] == 123000


@pytest.mark.asyncio
async def test_invalid_date_range(admin_client: AsyncClient):
    response = await admin_client.get(
        "/api/v1/reports/rentals/summary",
        params={"date_from": "2026-07-10", "date_to": "2026-07-01"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_customers_top_rental_count(admin_client: AsyncClient):
    response = await admin_client.get(
        "/api/v1/reports/customers/top",
        params={"metric": "rental_count", "limit": 5},
    )
    assert response.status_code == 200
    assert "items" in response.json()
