"""Sales module constants."""

from enum import StrEnum


class SalePermission(StrEnum):
    """RBAC permission keys used by Sales APIs (v1)."""

    VIEW = "sale.view"
    CREATE = "sale.create"


class SaleOrigin(StrEnum):
    """How a sale was initiated."""

    NORMAL_SALE = "NORMAL_SALE"
    MANDATORY_DAMAGE_PURCHASE = "MANDATORY_DAMAGE_PURCHASE"


class SaleStatus(StrEnum):
    """Sale lifecycle statuses."""

    COMPLETED = "COMPLETED"
    VOIDED = "VOIDED"  # reserved; no v1 API


class SalePaymentMethod(StrEnum):
    """Supported sale payment methods."""

    CASH = "CASH"
    CARD = "CARD"
    BANK_TRANSFER = "BANK_TRANSFER"
    OTHER = "OTHER"


class SaleSortField(StrEnum):
    """Allowed list sort columns."""

    SALE_NUMBER = "sale_number"
    STATUS = "status"
    SOLD_AT = "sold_at"
    CREATED_AT = "created_at"
