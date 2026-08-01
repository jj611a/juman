"""Service-level report metric tests."""

from datetime import date, timedelta

import pytest
from app.exceptions import AuthorizationError, ValidationError
from app.modules.inventory.constants import DressStatus
from app.modules.rentals.constants import RentalStatus
from app.modules.reports.services.report import ReportService
from app.modules.sales.constants import SaleOrigin
from app.modules.settlements.constants import SettlementStatus
from sqlalchemy.ext.asyncio import AsyncSession
from tests.modules.reports.conftest import (
    insert_active_rental,
    insert_completed_sale,
    insert_settlement,
    utc,
)


@pytest.mark.asyncio
async def test_dashboard_status_counts(report_service: ReportService, sample_dress, db_session: AsyncSession):
    sample_dress.status = DressStatus.AVAILABLE.value
    await db_session.flush()
    dash = await report_service.dashboard()
    assert dash.dresses_total >= 1
    assert dash.dresses_by_status.get("AVAILABLE", 0) >= 1
    assert "RETURNED" not in dash.dresses_by_status or dash.dresses_by_status.get("RETURNED", 0) == 0


@pytest.mark.asyncio
async def test_never_rented_and_inventory(report_service: ReportService, sample_dress):
    inv = await report_service.inventory_summary()
    assert inv.dresses_total >= 1
    assert any(row.key == "M" for row in inv.by_size)
    never = await report_service.never_rented(offset=0, limit=50, sort_by="created_at", sort_dir="desc")
    assert any(item.id == sample_dress.id for item in never.items)


@pytest.mark.asyncio
async def test_overdue_and_rentals_summary(
    report_service: ReportService,
    sample_dress,
    sample_customer,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
):
    from app.modules.reports.services import report as report_mod
    from app.utils.datetime import utc_now as real_now

    frozen = utc(2026, 7, 10, 12)
    monkeypatch.setattr(report_mod, "utc_now", lambda: frozen)

    await insert_active_rental(
        db_session,
        customer=sample_customer,
        dress=sample_dress,
        rental_at=utc(2026, 7, 1),
        expected_return_at=utc(2026, 7, 5),
    )
    summary = await report_service.rentals_summary(date(2026, 7, 1), date(2026, 7, 15))
    assert summary.created_in_range_total >= 1
    assert summary.active_now >= 1
    assert summary.overdue_now >= 1
    _ = real_now


@pytest.mark.asyncio
async def test_sales_frozen_price_and_financial(
    report_service: ReportService,
    sample_dress,
    sample_customer,
    db_session: AsyncSession,
):
    sold_at = utc(2026, 7, 5, 10)
    await insert_completed_sale(
        db_session,
        dress=sample_dress,
        amount=400000,
        sold_at=sold_at,
        customer_id=sample_customer.id,
    )
    # mutate dress default after sale — report must stay frozen
    sample_dress.default_sale_price = 999999
    await db_session.flush()

    sales = await report_service.sales_summary(date(2026, 7, 1), date(2026, 7, 10))
    assert sales.sales_count == 1
    assert sales.sale_revenue == 400000
    assert sales.sale_revenue_normal == 400000

    fin = await report_service.financial_summary(date(2026, 7, 1), date(2026, 7, 10))
    assert fin.sale_revenue == 400000
    assert fin.sale_payments_collected == 400000
    assert fin.total_cash_collected == 400000
    assert fin.total_charged == 400000


@pytest.mark.asyncio
async def test_settlement_charges_not_multiplied(
    report_service: ReportService,
    dress_service,
    sample_category,
    sample_customer,
    db_session: AsyncSession,
):
    dress = await dress_service.create_dress(
        category_id=sample_category.id,
        name_ar="فستان تسوية",
        size="L",
        colour="BLUE",
        purchase_price=100000,
        default_daily_rental_price=20000,
        default_sale_price=400000,
    )
    rental = await insert_active_rental(
        db_session,
        customer=sample_customer,
        dress=dress,
        rental_at=utc(2026, 6, 1),
        expected_return_at=utc(2026, 6, 3),
        status=RentalStatus.RETURN_PENDING.value,
    )
    created = utc(2026, 6, 4, 8)
    await insert_settlement(
        db_session,
        rental=rental,
        created_at=created,
        gross=50000,
        paid=20000,
        status=SettlementStatus.PARTIALLY_PAID.value,
    )
    # second payment row
    from uuid import uuid4
    from app.modules.settlements.models import RentalSettlementPayment
    from sqlalchemy import select
    from app.modules.settlements.models import RentalSettlement

    settlement = (
        await db_session.execute(select(RentalSettlement).where(RentalSettlement.rental_id == rental.id))
    ).scalar_one()
    db_session.add(
        RentalSettlementPayment(
            id=uuid4(),
            settlement_id=settlement.id,
            amount=10000,
            payment_method="CARD",
            received_at=utc(2026, 6, 5),
            received_by=None,
            reference_number=None,
            notes=None,
        )
    )
    await db_session.flush()

    fin = await report_service.financial_summary(date(2026, 6, 1), date(2026, 6, 10))
    assert fin.rental_charges_gross == 50000  # not duplicated by 2 payments
    assert fin.rental_payments_collected == 30000
    assert fin.rental_outstanding >= 0


@pytest.mark.asyncio
async def test_customers_top_financial_requires_perm(report_service: ReportService):
    with pytest.raises(AuthorizationError):
        await report_service.customers_top(
            metric="rental_gross", limit=5, has_financial=False
        )


@pytest.mark.asyncio
async def test_invalid_sort(report_service: ReportService):
    with pytest.raises(ValidationError):
        await report_service.never_rented(offset=0, limit=10, sort_by="password", sort_dir="asc")
