"""Returns module constants."""

from enum import StrEnum


class ReturnPermission(StrEnum):
    """RBAC permission keys for Returns APIs."""

    VIEW = "return.view"
    CREATE = "return.create"
    UPDATE = "return.update"


class ReturnStatus(StrEnum):
    """Return lifecycle statuses."""

    PENDING_INSPECTION = "PENDING_INSPECTION"
    INSPECTION_COMPLETED = "INSPECTION_COMPLETED"
    COMPLETED = "COMPLETED"


class ReturnSortField(StrEnum):
    """Allowed list sort columns."""

    RETURN_NUMBER = "return_number"
    RETURNED_AT = "returned_at"
    STATUS = "status"
    CREATED_AT = "created_at"
