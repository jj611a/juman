"""Report application service."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.exceptions import AuthorizationError, ValidationError
from app.modules.inventory.models import Dress
from app.modules.rentals.constants import RentalStatus
from app.modules.reports.constants import (
    CustomerTopMetric,
    NeverRentedSortField,
    RentalDetailSortField,
    ReportPermission,
    SaleDetailSortField,
)
from app.modules.reports.repositories.queries import ReportQueryRepository
from app.modules.reports.schemas.reports import (
    CountByKey,
    CustomerTopRow,
    CustomersSummaryReport,
    CustomersTopResponse,
    DashboardReport,
    FinancialDailyReport,
    FinancialDailyRow,
    FinancialSummaryReport,
    InspectionsSummaryReport,
    InventorySummaryReport,
    NeverRentedDressRow,
    NeverRentedListResponse,
    ProcessingSummaryReport,
    RentalDetailRow,
    RentalsDetailsResponse,
    RentalsSummaryReport,
    ReservationsSummaryReport,
    SaleDetailRow,
    SalesDetailsResponse,
    SalesSummaryReport,
)
from app.modules.reports.services.date_range import baghdad_day_window, resolve_half_open_range
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.schemas.common import PaginationMeta
from app.services.base import BaseService
from app.utils.datetime import ensure_utc, utc_now


class ReportService(BaseService):
    def __init__(self, session, *, settings: SettingService) -> None:
        super().__init__(session)
        self.settings = settings
        self.queries = ReportQueryRepository(session)

    async def _tz_name(self) -> str:
        return await self.settings.get_string(SettingKey.DEFAULT_TIMEZONE.value)

    async def _range(self, date_from: date | datetime, date_to: date | datetime):
        return resolve_half_open_range(date_from, date_to, tz_name=await self._tz_name())

    def _require_sort(self, sort_by: str, allowed: set[str]) -> str:
        if sort_by not in allowed:
            raise ValidationError(
                "حقل الترتيب غير مسموح",
                details={"field": "sort_by", "allowed": sorted(allowed)},
            )
        return sort_by

    def _require_dir(self, sort_dir: str) -> str:
        value = sort_dir.lower()
        if value not in {"asc", "desc"}:
            raise ValidationError(
                "اتجاه الترتيب غير صالح",
                details={"field": "sort_dir", "allowed": ["asc", "desc"]},
            )
        return value

    async def dashboard(self) -> DashboardReport:
        tz = await self._tz_name()
        now = utc_now()
        today_from, today_to = baghdad_day_window(now, tz_name=tz)
        status_counts = await self.queries.dress_status_counts()
        return DashboardReport(
            timezone=tz,
            as_of=now,
            today_from=today_from,
            today_to=today_to,
            dresses_total=await self.queries.dresses_total(),
            dresses_active=await self.queries.dresses_total(active_only=True),
            dresses_by_status=status_counts,
            rentals_active=await self.queries.rental_count(status=RentalStatus.ACTIVE.value),
            rentals_due_today=await self.queries.rental_count(due_from=today_from, due_to=today_to),
            rentals_overdue=await self.queries.rental_count(overdue_before=now),
            reservations_today=await self.queries.reservations_today(today_from, today_to),
            reservations_upcoming=await self.queries.reservations_upcoming(today_to),
            processing_batches_in_process=(
                await self.queries.processing_summary(today_from, today_to, long_running_before=now)
            )["batches_in_process"],
            dresses_in_processing=status_counts.get("PROCESSING", 0),
        )

    async def inventory_summary(self) -> InventorySummaryReport:
        return InventorySummaryReport(
            dresses_total=await self.queries.dresses_total(),
            dresses_by_status=await self.queries.dress_status_counts(),
            by_category=[CountByKey(key=k, count=c) for k, c in await self.queries.count_by_category()],
            by_size=[CountByKey(key=k, count=c) for k, c in await self.queries.count_by_dress_attr(Dress.size)],
            by_colour=[CountByKey(key=k, count=c) for k, c in await self.queries.count_by_dress_attr(Dress.colour)],
            by_brand=[CountByKey(key=k, count=c) for k, c in await self.queries.count_by_dress_attr(Dress.brand)],
        )

    async def never_rented(
        self, *, offset: int, limit: int, sort_by: str, sort_dir: str
    ) -> NeverRentedListResponse:
        sort_by = self._require_sort(sort_by, {f.value for f in NeverRentedSortField})
        sort_dir = self._require_dir(sort_dir)
        items, total = await self.queries.never_rented_list(
            offset=offset, limit=limit, sort_by=sort_by, sort_dir=sort_dir
        )
        return NeverRentedListResponse(
            items=[
                NeverRentedDressRow(
                    id=d.id,
                    barcode=d.barcode,
                    name_ar=d.name_ar,
                    category_id=d.category_id,
                    size=d.size,
                    colour=d.colour,
                    brand=d.brand,
                    status=d.status,
                    created_at=ensure_utc(d.created_at),
                )
                for d in items
            ],
            meta=PaginationMeta(offset=offset, limit=limit, total=total),
        )

    async def rentals_summary(self, date_from, date_to) -> RentalsSummaryReport:
        start, end = await self._range(date_from, date_to)
        by_status = await self.queries.rentals_created_by_status(start, end)
        now = utc_now()
        return RentalsSummaryReport(
            date_from=start,
            date_to=end,
            created_in_range_by_status=by_status,
            created_in_range_total=sum(by_status.values()),
            active_now=await self.queries.rental_count(status=RentalStatus.ACTIVE.value),
            overdue_now=await self.queries.rental_count(overdue_before=now),
            completed_settled_in_range=await self.queries.completed_settled_rentals(start, end),
            most_rented=await self.queries.most_rented_dresses(),
        )

    async def rentals_details(
        self, date_from, date_to, *, status, offset, limit, sort_by, sort_dir
    ) -> RentalsDetailsResponse:
        start, end = await self._range(date_from, date_to)
        sort_by = self._require_sort(sort_by, {f.value for f in RentalDetailSortField})
        sort_dir = self._require_dir(sort_dir)
        items, total = await self.queries.rentals_details(
            start=start,
            end=end,
            status=status,
            offset=offset,
            limit=limit,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )
        return RentalsDetailsResponse(
            items=[RentalDetailRow(**row) for row in items],
            meta=PaginationMeta(offset=offset, limit=limit, total=total),
        )

    async def reservations_summary(self, date_from, date_to) -> ReservationsSummaryReport:
        start, end = await self._range(date_from, date_to)
        by_status = await self.queries.reservations_created_by_status(start, end)
        return ReservationsSummaryReport(
            date_from=start,
            date_to=end,
            created_in_range_by_status=by_status,
            created_in_range_total=sum(by_status.values()),
            upcoming_confirmed=await self.queries.reservations_upcoming(utc_now()),
            by_customer=await self.queries.reservations_by_customer(start, end),
            by_cashier=await self.queries.reservations_by_cashier(start, end),
        )

    async def customers_summary(self, date_from, date_to) -> CustomersSummaryReport:
        start, end = await self._range(date_from, date_to)
        now = utc_now()
        return CustomersSummaryReport(
            date_from=start,
            date_to=end,
            total_customers=await self.queries.customers_total(),
            new_in_range=await self.queries.customers_new(start, end),
            with_active_rentals=await self.queries.customers_with_rental_status(
                RentalStatus.ACTIVE.value
            ),
            with_overdue_rentals=await self.queries.customers_with_rental_status(
                RentalStatus.ACTIVE.value, overdue_before=now
            ),
        )

    async def customers_top(
        self, *, metric: str, limit: int, has_financial: bool
    ) -> CustomersTopResponse:
        try:
            metric_enum = CustomerTopMetric(metric)
        except ValueError as exc:
            raise ValidationError(
                "مقياس الترتيب غير صالح",
                details={"field": "metric", "allowed": [m.value for m in CustomerTopMetric]},
            ) from exc
        if metric_enum != CustomerTopMetric.RENTAL_COUNT and not has_financial:
            raise AuthorizationError(
                "ليس لديك صلاحية لتنفيذ هذا الإجراء",
                details={"required_permission": ReportPermission.FINANCIAL_VIEW.value},
            )
        if metric_enum == CustomerTopMetric.RENTAL_COUNT:
            rows = await self.queries.top_customers_rental_count(limit=limit)
        elif metric_enum == CustomerTopMetric.RENTAL_GROSS:
            rows = await self.queries.top_customers_rental_gross(limit=limit)
        else:
            rows = await self.queries.top_customers_sale_value(limit=limit)
        return CustomersTopResponse(items=[CustomerTopRow(**r) for r in rows])

    async def inspections_summary(self, date_from, date_to) -> InspectionsSummaryReport:
        start, end = await self._range(date_from, date_to)
        data = await self.queries.inspections_summary(start, end)
        return InspectionsSummaryReport(date_from=start, date_to=end, **data)

    async def processing_summary(self, date_from, date_to) -> ProcessingSummaryReport:
        start, end = await self._range(date_from, date_to)
        mandatory = await self.settings.get_int(SettingKey.MANDATORY_PROCESSING_DAYS.value)
        optional = await self.settings.get_int(SettingKey.OPTIONAL_PROCESSING_DAYS.value)
        threshold_days = max(1, 2 * (mandatory + optional))
        long_before = utc_now() - timedelta(days=threshold_days)
        data = await self.queries.processing_summary(
            start, end, long_running_before=long_before
        )
        return ProcessingSummaryReport(date_from=start, date_to=end, **data)

    async def sales_summary(self, date_from, date_to) -> SalesSummaryReport:
        start, end = await self._range(date_from, date_to)
        data = await self.queries.sales_summary(start, end)
        return SalesSummaryReport(date_from=start, date_to=end, **data)

    async def sales_details(
        self, date_from, date_to, *, origin, offset, limit, sort_by, sort_dir
    ) -> SalesDetailsResponse:
        start, end = await self._range(date_from, date_to)
        sort_by = self._require_sort(sort_by, {f.value for f in SaleDetailSortField})
        sort_dir = self._require_dir(sort_dir)
        items, total = await self.queries.sales_details(
            start=start,
            end=end,
            origin=origin,
            offset=offset,
            limit=limit,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )
        return SalesDetailsResponse(
            items=[
                SaleDetailRow(
                    id=s.id,
                    sale_number=s.sale_number,
                    origin=s.origin,
                    status=s.status,
                    customer_id=s.customer_id,
                    total_amount=s.total_amount,
                    sold_at=ensure_utc(s.sold_at),
                    sold_by=s.sold_by,
                )
                for s in items
            ],
            meta=PaginationMeta(offset=offset, limit=limit, total=total),
        )

    async def financial_summary(self, date_from, date_to) -> FinancialSummaryReport:
        start, end = await self._range(date_from, date_to)
        data = await self.queries.financial_summary(start, end)
        return FinancialSummaryReport(date_from=start, date_to=end, **data)

    async def financial_daily(self, date_from, date_to) -> FinancialDailyReport:
        tz_name = await self._tz_name()
        start, end = resolve_half_open_range(date_from, date_to, tz_name=tz_name)
        raw = await self.queries.financial_daily(start, end, tz_name=tz_name)
        tz = ZoneInfo(tz_name)
        buckets: dict[date, dict[str, int]] = defaultdict(
            lambda: {
                "rental_charges_gross": 0,
                "rental_payments_collected": 0,
                "sale_revenue": 0,
                "sale_payments_collected": 0,
            }
        )

        def day_of(dt: datetime) -> date:
            return ensure_utc(dt).astimezone(tz).date()

        for created_at, amount in raw["settlements"]:
            buckets[day_of(created_at)]["rental_charges_gross"] += int(amount)
        for received_at, amount in raw["rental_payments"]:
            buckets[day_of(received_at)]["rental_payments_collected"] += int(amount)
        for sold_at, amount in raw["sales"]:
            buckets[day_of(sold_at)]["sale_revenue"] += int(amount)
        for received_at, amount in raw["sale_payments"]:
            buckets[day_of(received_at)]["sale_payments_collected"] += int(amount)

        days = []
        for day in sorted(buckets):
            b = buckets[day]
            cash = b["rental_payments_collected"] + b["sale_payments_collected"]
            charged = b["rental_charges_gross"] + b["sale_revenue"]
            days.append(
                FinancialDailyRow(
                    day=day,
                    rental_charges_gross=b["rental_charges_gross"],
                    rental_payments_collected=b["rental_payments_collected"],
                    sale_revenue=b["sale_revenue"],
                    sale_payments_collected=b["sale_payments_collected"],
                    total_cash_collected=cash,
                    total_charged=charged,
                )
            )
        return FinancialDailyReport(
            date_from=start, date_to=end, timezone=tz_name, days=days
        )
