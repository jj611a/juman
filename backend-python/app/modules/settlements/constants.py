"""Rental settlement module constants."""

from enum import StrEnum


class SettlementPermission(StrEnum):
    """RBAC permission keys for rental settlement APIs."""

    VIEW = "rental.settlement.view"
    CREATE = "rental.settlement.create"
    COLLECT = "rental.settlement.collect"
    ADJUST = "rental.settlement.adjust"


class SettlementStatus(StrEnum):
    """Settlement lifecycle statuses."""

    OPEN = "OPEN"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"
    VOIDED = "VOIDED"  # reserved; no v1 API


class ChargeType(StrEnum):
    """Immutable charge line kinds."""

    RENTAL = "RENTAL"
    LATE = "LATE"
    DAMAGE = "DAMAGE"
    INITIAL_CREDIT = "INITIAL_CREDIT"


class PaymentMethod(StrEnum):
    """Supported settlement payment methods."""

    CASH = "CASH"
    CARD = "CARD"
    BANK_TRANSFER = "BANK_TRANSFER"
    OTHER = "OTHER"


class SettlementSortField(StrEnum):
    """Allowed list sort columns."""

    SETTLEMENT_NUMBER = "settlement_number"
    STATUS = "status"
    CREATED_AT = "created_at"
    SETTLED_AT = "settled_at"
