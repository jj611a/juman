"""Enumerations for the Settings module."""

from enum import StrEnum


class SettingValueType(StrEnum):
    """Supported value types stored in the settings table."""

    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    JSON = "json"


class SettingCategory(StrEnum):
    """Logical grouping for settings."""

    COMPANY = "company"
    FINANCIAL = "financial"
    PROCESSING = "processing"
    INVENTORY = "inventory"
    CUSTOMERS = "customers"
    RESERVATIONS = "reservations"
    SALES = "sales"
    RENTALS = "rentals"
    RETURNS = "returns"
    INSPECTION = "inspection"
    SYSTEM = "system"
