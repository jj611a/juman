"""Inspection module constants."""

from enum import StrEnum


class InspectionPermission(StrEnum):
    """RBAC permission keys for Inspection APIs."""

    VIEW = "inspection.view"
    CREATE = "inspection.create"
    UPDATE = "inspection.update"


class InspectionStatus(StrEnum):
    """Inspection lifecycle statuses."""

    PENDING = "PENDING"
    COMPLETED = "COMPLETED"


class DressCondition(StrEnum):
    """Condition recorded per inspected dress."""

    GOOD = "GOOD"
    MINOR_DAMAGE = "MINOR_DAMAGE"
    MAJOR_DAMAGE = "MAJOR_DAMAGE"


class InspectionSortField(StrEnum):
    """Allowed list sort columns."""

    INSPECTION_NUMBER = "inspection_number"
    INSPECTED_AT = "inspected_at"
    STATUS = "status"
    CREATED_AT = "created_at"
