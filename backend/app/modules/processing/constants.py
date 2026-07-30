"""Processing (Laundry) module constants."""

from enum import StrEnum


class ProcessingPermission(StrEnum):
    """RBAC permission keys for Processing APIs."""

    VIEW = "processing.view"
    CREATE = "processing.create"
    UPDATE = "processing.update"
    COMPLETE = "processing.complete"


class ProcessingStatus(StrEnum):
    """Processing batch / item lifecycle statuses."""

    PENDING = "PENDING"
    IN_PROCESS = "IN_PROCESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"  # reserved; no v1 API


class ProcessingSortField(StrEnum):
    """Allowed list sort columns."""

    PROCESSING_NUMBER = "processing_number"
    STARTED_AT = "started_at"
    STATUS = "status"
    CREATED_AT = "created_at"


ACTIVE_PROCESSING_STATUSES: frozenset[str] = frozenset(
    {
        ProcessingStatus.PENDING.value,
        ProcessingStatus.IN_PROCESS.value,
    }
)
