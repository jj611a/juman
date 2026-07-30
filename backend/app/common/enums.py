"""Shared enumerations used across foundation and future modules."""

from enum import StrEnum


class RecordStatus(StrEnum):
    """Generic soft-status values for future domain entities."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"
