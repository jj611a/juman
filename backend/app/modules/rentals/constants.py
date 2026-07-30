"""Rentals module constants."""

from enum import StrEnum


class RentalPermission(StrEnum):
    """RBAC permission keys for Rentals APIs."""

    VIEW = "rental.view"
    CREATE = "rental.create"
    UPDATE = "rental.update"
    CANCEL = "rental.cancel"
    RETURN = "rental.return"


class RentalStatus(StrEnum):
    """Rental lifecycle statuses."""

    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    RETURN_PENDING = "RETURN_PENDING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class InitialPaymentType(StrEnum):
    """How the initial payment amount is specified."""

    FIXED_AMOUNT = "FIXED_AMOUNT"
    PERCENTAGE = "PERCENTAGE"


class RentalSortField(StrEnum):
    """Allowed list sort columns."""

    RENTAL_NUMBER = "rental_number"
    RENTAL_AT = "rental_at"
    EXPECTED_RETURN_AT = "expected_return_at"
    STATUS = "status"
    CREATED_AT = "created_at"
