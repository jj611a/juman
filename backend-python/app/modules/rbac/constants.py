"""Stable role name constants."""

from enum import StrEnum


class SystemRoleName(StrEnum):
    """Seeded system role names (English keys for code/database)."""

    ADMIN = "Admin"
    CASHIER = "Cashier"
    INVENTORY = "Inventory"
    LAUNDRY = "Laundry"
