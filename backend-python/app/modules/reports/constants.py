"""Reports module constants."""

from enum import StrEnum


class ReportPermission(StrEnum):
    """RBAC permission keys used by Reports APIs (v1)."""

    VIEW = "reports.view"
    FINANCIAL_VIEW = "reports.financial.view"


MAX_RANGE_DAYS = 366
NULL_BRAND_KEY = "__none__"


class CustomerTopMetric(StrEnum):
    """Allow-listed ranking metrics for customer top report."""

    RENTAL_COUNT = "rental_count"
    RENTAL_GROSS = "rental_gross"
    SALE_VALUE = "sale_value"


class RentalDetailSortField(StrEnum):
    """Allowed sort columns for rental detail reports."""

    RENTAL_AT = "rental_at"
    RENTAL_NUMBER = "rental_number"
    STATUS = "status"
    CREATED_AT = "created_at"


class SaleDetailSortField(StrEnum):
    """Allowed sort columns for sale detail reports."""

    SOLD_AT = "sold_at"
    SALE_NUMBER = "sale_number"
    TOTAL_AMOUNT = "total_amount"
    CREATED_AT = "created_at"


class NeverRentedSortField(StrEnum):
    """Allowed sort columns for never-rented inventory."""

    CREATED_AT = "created_at"
    BARCODE = "barcode"
    NAME_AR = "name_ar"
