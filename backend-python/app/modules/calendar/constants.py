"""Calendar module constants."""

from enum import StrEnum


class CalendarPermission(StrEnum):
    """RBAC permission keys for Calendar APIs."""

    VIEW = "calendar.view"
    MANAGE = "calendar.manage"


class CalendarBlockType(StrEnum):
    """Busy-interval kinds on a dress timeline (future-safe)."""

    RESERVATION = "RESERVATION"
    RENTAL = "RENTAL"
    PROCESSING = "PROCESSING"
    MAINTENANCE = "MAINTENANCE"
