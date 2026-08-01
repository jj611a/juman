"""Broader coverage for report queries and routes."""

from datetime import date
from uuid import uuid4

import pytest
from app.modules.inspection.constants import DressCondition, InspectionStatus
from app.modules.inspection.models import Inspection, InspectionItem
from app.modules.processing.constants import ProcessingStatus
from app.modules.processing.models import ProcessingBatch
from app.modules.rentals.constants import RentalStatus
from app.modules.reports.services.report import ReportService
from app.modules.reservations.constants import ReservationStatus
from app.modules.reservations.models import Reservation
from app.modules.returns.models import Return, ReturnItem
from app.modules.sales.constants import SaleOrigin
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tests.modules.reports.conftest import (
    insert_active_rental,
    insert_completed_sale,
    utc,
)


@pytest.mark.asyncio
async def test_reservations_customers_processing_inspections(
    report_service: ReportService,
    sample_customer,
    sample_dress,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
):
    from app.modules.reports.services import report as report_mod

    monkeypatch.setattr(report_mod, "utc_now", lambda: utc(2026, 7, 10, 12))

    res = Reservation(
        id=uuid4(),
        reservation_number=f"RSV-{uuid4().hex[:8].upper()}",
        customer_id=sample_customer.id,
        reservation_at=utc(2026, 7, 2),
        rental_start_at=utc(2026, 7, 20),
        expected_return_at=utc(2026, 7, 22),
        status=ReservationStatus.CONFIRMED.value,
        notes=None,
    )
    db_session.add(res)
    await db_session.flush()
    res.created_at = utc(2026, 7, 2)
    res.created_by = uuid4()
    await db_session.flush()

    rental = await insert_active_rental(
        db_session,
        customer=sample_customer,
        dress=sample_dress,
        rental_at=utc(2026, 6, 1),
        expected_return_at=utc(2026, 6, 3),
        status=RentalStatus.RETURN_PENDING.value,
    )
    ret = Return(
        id=uuid4(),
        return_number=f"RET-{uuid4().hex[:8].upper()}",
        rental_id=rental.id,
        customer_id=sample_customer.id,
        returned_at=utc(2026, 6, 4),
        status="PENDING_INSPECTION",
        notes=None,
    )
    db_session.add(ret)
    await db_session.flush()
    ri = ReturnItem(
        id=uuid4(),
        return_id=ret.id,
        rental_item_id=rental._test_item_id,
        dress_id=sample_dress.id,
        returned_at=utc(2026, 6, 4),
        notes=None,
    )
    db_session.add(ri)
    await db_session.flush()

    insp = Inspection(
        id=uuid4(),
        inspection_number=f"INS-{uuid4().hex[:8].upper()}",
        return_id=ret.id,
        inspected_at=utc(2026, 6, 4, 10),
        inspected_by=None,
        status=InspectionStatus.COMPLETED.value,
        notes=None,
    )
    db_session.add(insp)
    await db_session.flush()
    db_session.add(
        InspectionItem(
            id=uuid4(),
            inspection_id=insp.id,
            return_item_id=ri.id,
            dress_id=sample_dress.id,
            condition=DressCondition.MINOR_DAMAGE.value,
            repair_penalty_amount=5000,
            requires_laundry=True,
            send_to_ruined=False,
            notes=None,
        )
    )
    await db_session.flush()

    batch = ProcessingBatch(
        id=uuid4(),
        processing_number=f"PRC-{uuid4().hex[:8].upper()}",
        status=ProcessingStatus.IN_PROCESS.value,
        started_at=utc(2026, 7, 1),
        mandatory_processing_end_at=utc(2026, 7, 3),
        optional_extra_day_enabled=True,
        final_processing_end_at=utc(2026, 7, 4),
        completed_at=None,
        notes=None,
    )
    db_session.add(batch)
    await db_session.flush()

    rsum = await report_service.reservations_summary(date(2026, 7, 1), date(2026, 7, 15))
    assert rsum.created_in_range_total >= 1
    assert rsum.upcoming_confirmed >= 1

    csum = await report_service.customers_summary(date(2026, 7, 1), date(2026, 7, 15))
    assert csum.total_customers >= 1

    top = await report_service.customers_top(metric="rental_count", limit=5, has_financial=True)
    assert isinstance(top.items, list)

    top_g = await report_service.customers_top(metric="rental_gross", limit=5, has_financial=True)
    assert isinstance(top_g.items, list)

    isum = await report_service.inspections_summary(date(2026, 6, 1), date(2026, 6, 10))
    assert isum.inspections_completed >= 1
    assert isum.minor_repair_penalties_total == 5000

    psum = await report_service.processing_summary(date(2026, 7, 1), date(2026, 7, 15))
    assert psum.batches_in_process >= 1
    assert psum.optional_extra_day_count >= 1


@pytest.mark.asyncio
async def test_sales_details_and_daily_and_never_rented_api(
    report_service: ReportService,
    admin_client: AsyncClient,
    dress_service,
    sample_category,
    sample_customer,
    db_session: AsyncSession,
):
    d1 = await dress_service.create_dress(
        category_id=sample_category.id,
        name_ar="بيع1",
        size="S",
        colour="BLACK",
        purchase_price=1000,
        default_daily_rental_price=1000,
        default_sale_price=10000,
    )
    d2 = await dress_service.create_dress(
        category_id=sample_category.id,
        name_ar="بيع2",
        size="S",
        colour="WHITE",
        purchase_price=1000,
        default_daily_rental_price=1000,
        default_sale_price=10000,
    )
    await insert_completed_sale(
        db_session, dress=d1, amount=8000, sold_at=utc(2026, 7, 2, 11), customer_id=sample_customer.id
    )
    # override line (actual != default)
    await insert_completed_sale(
        db_session,
        dress=d2,
        amount=12000,
        sold_at=utc(2026, 7, 3, 11),
        origin=SaleOrigin.NORMAL_SALE.value,
        customer_id=sample_customer.id,
    )

    details = await report_service.sales_details(
        date(2026, 7, 1),
        date(2026, 7, 10),
        origin=None,
        offset=0,
        limit=50,
        sort_by="sold_at",
        sort_dir="asc",
    )
    assert details.meta.total >= 2

    daily = await report_service.financial_daily(date(2026, 7, 1), date(2026, 7, 10))
    assert daily.timezone == "Asia/Baghdad"
    assert sum(day.sale_revenue for day in daily.days) >= 20000

    top_sale = await report_service.customers_top(metric="sale_value", limit=5, has_financial=True)
    assert any(row.value > 0 for row in top_sale.items)

    nr = await admin_client.get("/api/v1/reports/inventory/never-rented")
    assert nr.status_code == 200

    for path in (
        "/api/v1/reports/rentals/details",
        "/api/v1/reports/reservations/summary",
        "/api/v1/reports/customers/summary",
        "/api/v1/reports/inspections/summary",
        "/api/v1/reports/processing/summary",
        "/api/v1/reports/sales/summary",
        "/api/v1/reports/sales/details",
        "/api/v1/reports/financial/daily",
    ):
        resp = await admin_client.get(
            path, params={"date_from": "2026-07-01", "date_to": "2026-07-15"}
        )
        assert resp.status_code == 200, path


@pytest.mark.asyncio
async def test_rentals_details_with_return(
    report_service: ReportService,
    sample_dress,
    sample_customer,
    db_session: AsyncSession,
):
    rental = await insert_active_rental(
        db_session,
        customer=sample_customer,
        dress=sample_dress,
        rental_at=utc(2026, 5, 1),
        expected_return_at=utc(2026, 5, 3),
        status=RentalStatus.RETURN_PENDING.value,
    )
    db_session.add(
        Return(
            id=uuid4(),
            return_number=f"RET-{uuid4().hex[:8].upper()}",
            rental_id=rental.id,
            customer_id=sample_customer.id,
            returned_at=utc(2026, 5, 4),
            status="PENDING_INSPECTION",
            notes=None,
        )
    )
    await db_session.flush()
    details = await report_service.rentals_details(
        date(2026, 5, 1),
        date(2026, 5, 10),
        status=None,
        offset=0,
        limit=20,
        sort_by="rental_at",
        sort_dir="desc",
    )
    assert details.meta.total >= 1
    assert any(row.duration_seconds is not None for row in details.items)
