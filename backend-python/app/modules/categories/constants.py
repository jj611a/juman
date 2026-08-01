"""Categories module constants."""

from enum import StrEnum


class CategoryPermission(StrEnum):
    """RBAC permission keys for Categories APIs."""

    VIEW = "categories.view"
    CREATE = "categories.create"
    UPDATE = "categories.update"
    DELETE = "categories.delete"


class CategorySortField(StrEnum):
    """Allowed list sort columns."""

    DISPLAY_ORDER = "display_order"
    NAME_AR = "name_ar"
    NAME_EN = "name_en"
    CREATED_AT = "created_at"
    IS_ACTIVE = "is_active"
