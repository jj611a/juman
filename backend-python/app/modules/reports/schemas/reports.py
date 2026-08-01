"""Reports response schemas."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from app.schemas.common import APIModel, PaginationMeta


class CountByKey(APIModel):
    key: str
    count: int


class DashboardReport(APIModel):
    timezone: str
    as_of: datetime
    today_from: datetime
    today_to: datetime
    dresses_total: int
    dresses_active: int
    dresses_by_status: dict[str, int]
    rentals_active: int
    rentals_due_today: int
    rentals_overdue: int
    reservations_today: int
    reservations_upcoming: int
    processing_batches_in_process: int
    dresses_in_processing: int


class InventorySummaryReport(APIModel):
    dresses_total: int
    dresses_by_status: dict[str, int]
    by_category: list[CountByKey]
    by_size: list[CountByKey]
    by_colour: list[CountByKey]
    by_brand: list[CountByKey]


class NeverRentedDressRow(APIModel):
    id: UUID
    barcode: str
    name_ar: str
    category_id: UUID
    size: str
    colour: str
    brand: str | None
    status: str
    created_at: datetime


class NeverRentedListResponse(APIModel):
    items: list[NeverRentedDressRow]
    meta: PaginationMeta


class RentalsSummaryReport(APIModel):
    date_from: datetime
    date_to: datetime
    created_in_range_by_status: dict[str, int]
    created_in_range_total: int
    active_now: int
    overdue_now: int
    completed_settled_in_range: int
    most_rented: list[dict]


class RentalDetailRow(APIModel):
    id: UUID
    rental_number: str
    customer_id: UUID
    status: str
    rental_at: datetime
    expected_return_at: datetime
    estimated_total: int
    duration_seconds: int | None = None


class RentalsDetailsResponse(APIModel):
    items: list[RentalDetailRow]
    meta: PaginationMeta


class ReservationsSummaryReport(APIModel):
    date_from: datetime
    date_to: datetime
    created_in_range_by_status: dict[str, int]
    created_in_range_total: int
    upcoming_confirmed: int
    by_customer: list[dict]
    by_cashier: list[dict]


class CustomersSummaryReport(APIModel):
    date_from: datetime
    date_to: datetime
    total_customers: int
    new_in_range: int
    with_active_rentals: int
    with_overdue_rentals: int


class CustomerTopRow(APIModel):
    id: UUID
    customer_number: str
    full_name: str
    metric: str
    value: int


class CustomersTopResponse(APIModel):
    items: list[CustomerTopRow]


class InspectionsSummaryReport(APIModel):
    date_from: datetime
    date_to: datetime
    inspections_completed: int
    items_by_condition: dict[str, int]
    minor_repair_penalties_total: int
    damage_by_dress: list[dict]
    damage_by_customer: list[dict]
    repeated_damage_dresses: list[dict]


class ProcessingSummaryReport(APIModel):
    date_from: datetime
    date_to: datetime
    batches_in_process: int
    dresses_in_processing: int
    started_in_range: int
    completed_in_range: int
    optional_extra_day_count: int
    avg_duration_seconds: float | None
    long_running_batches: int


class SalesSummaryReport(APIModel):
    date_from: datetime
    date_to: datetime
    sales_count: int
    sale_revenue: int
    sale_revenue_normal: int
    sale_revenue_mandatory: int
    average_sale_value: float | None
    override_line_count: int
    by_cashier: list[dict]
    by_category: list[dict]


class SaleDetailRow(APIModel):
    id: UUID
    sale_number: str
    origin: str
    status: str
    customer_id: UUID | None
    total_amount: int
    sold_at: datetime
    sold_by: UUID | None


class SalesDetailsResponse(APIModel):
    items: list[SaleDetailRow]
    meta: PaginationMeta


class FinancialSummaryReport(APIModel):
    date_from: datetime
    date_to: datetime
    rental_charges_gross: int
    rental_charges_rental: int
    rental_charges_late: int
    rental_charges_minor_damage: int
    rental_adjustments: int
    rental_initial_credits: int
    rental_payments_collected: int
    rental_outstanding: int
    sale_revenue: int
    sale_revenue_normal: int
    sale_revenue_mandatory: int
    sale_payments_collected: int
    total_cash_collected: int
    total_charged: int


class FinancialDailyRow(APIModel):
    day: date
    rental_charges_gross: int
    rental_payments_collected: int
    sale_revenue: int
    sale_payments_collected: int
    total_cash_collected: int
    total_charged: int


class FinancialDailyReport(APIModel):
    date_from: datetime
    date_to: datetime
    timezone: str
    days: list[FinancialDailyRow]
