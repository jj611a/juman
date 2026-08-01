"""Inventory / Dress constants."""

from enum import StrEnum


class InventoryPermission(StrEnum):
    """RBAC permission keys for Dress APIs."""

    VIEW = "inventory.view"
    CREATE = "inventory.create"
    UPDATE = "inventory.update"
    DELETE = "inventory.delete"


class DressStatus(StrEnum):
    """Stored dress status codes.

    Transitions are enforced only by ``DressStatusService`` (Phase 4).
    ``RETURNED`` is retained for schema continuity but is not in the Phase 4
    transition graph.
    """

    AVAILABLE = "AVAILABLE"
    RESERVED = "RESERVED"
    RENTED = "RENTED"
    RETURNED = "RETURNED"
    INSPECTION = "INSPECTION"
    PROCESSING = "PROCESSING"
    SOLD = "SOLD"
    RUINED = "RUINED"
    RUINED_PENDING_SALE = "RUINED_PENDING_SALE"


class DressSize(StrEnum):
    """Allowed dress sizes."""

    XS = "XS"
    S = "S"
    M = "M"
    L = "L"
    XL = "XL"
    XXL = "XXL"
    XXXL = "3XL"
    XXXXL = "4XL"
    FREE = "FREE"


class DressColour(StrEnum):
    """Allowed dress colour codes."""

    BLACK = "BLACK"
    WHITE = "WHITE"
    RED = "RED"
    PINK = "PINK"
    BLUE = "BLUE"
    GREEN = "GREEN"
    GOLD = "GOLD"
    SILVER = "SILVER"
    BEIGE = "BEIGE"
    NAVY = "NAVY"
    PURPLE = "PURPLE"
    MULTI = "MULTI"
    OTHER = "OTHER"


class DressSortField(StrEnum):
    """Allowed list sort columns (Phase 5 search API)."""

    BARCODE = "barcode"
    NAME_AR = "name_ar"
    CATEGORY = "category"
    PURCHASE_PRICE = "purchase_price"
    DEFAULT_DAILY_RENTAL_PRICE = "default_daily_rental_price"
    DEFAULT_SALE_PRICE = "default_sale_price"
    CREATED_AT = "created_at"
    UPDATED_AT = "updated_at"
