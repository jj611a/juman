"""Customers module constants."""

from enum import StrEnum


class CustomerPermission(StrEnum):
    """RBAC permission keys for Customers APIs (seeded as customer.*)."""

    VIEW = "customer.view"
    CREATE = "customer.create"
    UPDATE = "customer.update"
    DELETE = "customer.delete"


class CustomerGender(StrEnum):
    """Allowed gender codes."""

    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"


class CustomerSortField(StrEnum):
    """Allowed list sort columns."""

    CUSTOMER_NUMBER = "customer_number"
    FULL_NAME = "full_name"
    PHONE = "phone"
    CREATED_AT = "created_at"
