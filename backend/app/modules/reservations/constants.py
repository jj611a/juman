"""Reservations module constants."""

from enum import StrEnum


class ReservationPermission(StrEnum):
    """RBAC permission keys for Reservations APIs (already seeded)."""

    VIEW = "reservation.view"
    CREATE = "reservation.create"
    UPDATE = "reservation.update"
    CANCEL = "reservation.cancel"


class ReservationStatus(StrEnum):
    """Reservation lifecycle statuses."""

    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"
    CONVERTED_TO_RENTAL = "CONVERTED_TO_RENTAL"


class ReservationSortField(StrEnum):
    """Allowed list sort columns."""

    RESERVATION_NUMBER = "reservation_number"
    RESERVATION_AT = "reservation_at"
    RENTAL_START_AT = "rental_start_at"
    EXPECTED_RETURN_AT = "expected_return_at"
    STATUS = "status"
    CREATED_AT = "created_at"
