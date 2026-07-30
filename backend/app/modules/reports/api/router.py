"""Reports HTTP routes — read-only aggregates."""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.rbac.dependencies import require_permission
from app.modules.reports.constants import (
    CustomerTopMetric,
    NeverRentedSortField,
    RentalDetailSortField,
    ReportPermission,
    SaleDetailSortField,
)
from app.modules.reports.dependencies import get_report_service
from app.modules.reports.schemas.reports import (
    CustomersSummaryReport,
    CustomersTopResponse,
    DashboardReport,
    FinancialDailyReport,
    FinancialSummaryReport,
    InspectionsSummaryReport,
    InventorySummaryReport,
    NeverRentedListResponse,
    ProcessingSummaryReport,
    RentalsDetailsResponse,
    RentalsSummaryReport,
    ReservationsSummaryReport,
    SalesDetailsResponse,
    SalesSummaryReport,
)
from app.modules.reports.services.report import ReportService
from app.modules.rbac.services.role import RoleService
from app.modules.rbac.dependencies import get_role_service

router = APIRouter(prefix="/reports", tags=["Reports"])



@router.get("/dashboard", response_model=DashboardReport, summary="Operational dashboard snapshot")
async def dashboard(
    _principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(ReportPermission.VIEW.value))
    ],
    service: Annotated[ReportService, Depends(get_report_service)],
) -> DashboardReport:
    return await service.dashboard()


@router.get(
    "/inventory/summary",
    response_model=InventorySummaryReport,
    summary="Inventory status and attribute breakdown",
)
async def inventory_summary(
    _principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(ReportPermission.VIEW.value))
    ],
    service: Annotated[ReportService, Depends(get_report_service)],
) -> InventorySummaryReport:
    return await service.inventory_summary()


@router.get(
    "/inventory/never-rented",
    response_model=NeverRentedListResponse,
    summary="Dresses never rented (non-cancelled history)",
)
async def inventory_never_rented(
    _principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(ReportPermission.VIEW.value))
    ],
    service: Annotated[ReportService, Depends(get_report_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    sort_by: Annotated[NeverRentedSortField, Query()] = NeverRentedSortField.CREATED_AT,
    sort_dir: Annotated[str, Query(pattern="^(?i)(asc|desc)$")] = "desc",
) -> NeverRentedListResponse:
    return await service.never_rented(
        offset=offset, limit=limit, sort_by=sort_by.value, sort_dir=sort_dir
    )


@router.get("/rentals/summary", response_model=RentalsSummaryReport, summary="Rentals summary")
async def rentals_summary(
    _principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(ReportPermission.VIEW.value))
    ],
    service: Annotated[ReportService, Depends(get_report_service)],
    date_from: Annotated[date | datetime, Query()],
    date_to: Annotated[date | datetime, Query()],
) -> RentalsSummaryReport:
    return await service.rentals_summary(date_from, date_to)


@router.get("/rentals/details", response_model=RentalsDetailsResponse, summary="Rentals details")
async def rentals_details(
    _principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(ReportPermission.VIEW.value))
    ],
    service: Annotated[ReportService, Depends(get_report_service)],
    date_from: Annotated[date | datetime, Query()],
    date_to: Annotated[date | datetime, Query()],
    status: Annotated[str | None, Query()] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    sort_by: Annotated[RentalDetailSortField, Query()] = RentalDetailSortField.RENTAL_AT,
    sort_dir: Annotated[str, Query(pattern="^(?i)(asc|desc)$")] = "desc",
) -> RentalsDetailsResponse:
    return await service.rentals_details(
        date_from,
        date_to,
        status=status.strip().upper() if status else None,
        offset=offset,
        limit=limit,
        sort_by=sort_by.value,
        sort_dir=sort_dir,
    )


@router.get(
    "/reservations/summary",
    response_model=ReservationsSummaryReport,
    summary="Reservations summary",
)
async def reservations_summary(
    _principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(ReportPermission.VIEW.value))
    ],
    service: Annotated[ReportService, Depends(get_report_service)],
    date_from: Annotated[date | datetime, Query()],
    date_to: Annotated[date | datetime, Query()],
) -> ReservationsSummaryReport:
    return await service.reservations_summary(date_from, date_to)


@router.get("/customers/summary", response_model=CustomersSummaryReport, summary="Customers summary")
async def customers_summary(
    _principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(ReportPermission.VIEW.value))
    ],
    service: Annotated[ReportService, Depends(get_report_service)],
    date_from: Annotated[date | datetime, Query()],
    date_to: Annotated[date | datetime, Query()],
) -> CustomersSummaryReport:
    return await service.customers_summary(date_from, date_to)


@router.get("/customers/top", response_model=CustomersTopResponse, summary="Top customers by metric")
async def customers_top(
    principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(ReportPermission.VIEW.value))
    ],
    service: Annotated[ReportService, Depends(get_report_service)],
    roles: Annotated[RoleService, Depends(get_role_service)],
    metric: Annotated[CustomerTopMetric, Query()] = CustomerTopMetric.RENTAL_COUNT,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> CustomersTopResponse:
    has_financial = await roles.role_has_permission(
        principal.user.role_id, ReportPermission.FINANCIAL_VIEW.value
    )
    return await service.customers_top(
        metric=metric.value, limit=limit, has_financial=has_financial
    )


@router.get(
    "/inspections/summary",
    response_model=InspectionsSummaryReport,
    summary="Inspection and damage summary",
)
async def inspections_summary(
    _principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(ReportPermission.VIEW.value))
    ],
    service: Annotated[ReportService, Depends(get_report_service)],
    date_from: Annotated[date | datetime, Query()],
    date_to: Annotated[date | datetime, Query()],
) -> InspectionsSummaryReport:
    return await service.inspections_summary(date_from, date_to)


@router.get(
    "/processing/summary",
    response_model=ProcessingSummaryReport,
    summary="Processing / laundry summary",
)
async def processing_summary(
    _principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(ReportPermission.VIEW.value))
    ],
    service: Annotated[ReportService, Depends(get_report_service)],
    date_from: Annotated[date | datetime, Query()],
    date_to: Annotated[date | datetime, Query()],
) -> ProcessingSummaryReport:
    return await service.processing_summary(date_from, date_to)


@router.get("/sales/summary", response_model=SalesSummaryReport, summary="Sales summary")
async def sales_summary(
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(ReportPermission.FINANCIAL_VIEW.value)),
    ],
    service: Annotated[ReportService, Depends(get_report_service)],
    date_from: Annotated[date | datetime, Query()],
    date_to: Annotated[date | datetime, Query()],
) -> SalesSummaryReport:
    return await service.sales_summary(date_from, date_to)


@router.get("/sales/details", response_model=SalesDetailsResponse, summary="Sales details")
async def sales_details(
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(ReportPermission.FINANCIAL_VIEW.value)),
    ],
    service: Annotated[ReportService, Depends(get_report_service)],
    date_from: Annotated[date | datetime, Query()],
    date_to: Annotated[date | datetime, Query()],
    origin: Annotated[str | None, Query()] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    sort_by: Annotated[SaleDetailSortField, Query()] = SaleDetailSortField.SOLD_AT,
    sort_dir: Annotated[str, Query(pattern="^(?i)(asc|desc)$")] = "desc",
) -> SalesDetailsResponse:
    return await service.sales_details(
        date_from,
        date_to,
        origin=origin.strip().upper() if origin else None,
        offset=offset,
        limit=limit,
        sort_by=sort_by.value,
        sort_dir=sort_dir,
    )


@router.get(
    "/financial/summary",
    response_model=FinancialSummaryReport,
    summary="Named financial metrics for a period",
)
async def financial_summary(
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(ReportPermission.FINANCIAL_VIEW.value)),
    ],
    service: Annotated[ReportService, Depends(get_report_service)],
    date_from: Annotated[date | datetime, Query()],
    date_to: Annotated[date | datetime, Query()],
) -> FinancialSummaryReport:
    return await service.financial_summary(date_from, date_to)


@router.get(
    "/financial/daily",
    response_model=FinancialDailyReport,
    summary="Daily financial buckets (business timezone)",
)
async def financial_daily(
    _principal: Annotated[
        AuthenticatedPrincipal,
        Depends(require_permission(ReportPermission.FINANCIAL_VIEW.value)),
    ],
    service: Annotated[ReportService, Depends(get_report_service)],
    date_from: Annotated[date | datetime, Query()],
    date_to: Annotated[date | datetime, Query()],
) -> FinancialDailyReport:
    return await service.financial_daily(date_from, date_to)
