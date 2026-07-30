"""Unit tests for RBAC validation helpers."""

import pytest
from app.exceptions import ValidationError
from app.modules.rbac.validation import (
    derive_module_from_key,
    validate_permission_key,
    validate_role_name,
)


@pytest.mark.parametrize(
    ("key", "expected"),
    [
        ("inventory.view", "inventory.view"),
        ("rental.return", "rental.return"),
        ("users.manage", "users.manage"),
        ("Inventory.View", "inventory.view"),
    ],
)
def test_validate_permission_key_valid(key: str, expected: str) -> None:
    assert validate_permission_key(key) == expected


@pytest.mark.parametrize("key", ["inventory", "Inventory", ".view", "inv..view", "1.bad", ""])
def test_validate_permission_key_invalid(key: str) -> None:
    with pytest.raises(ValidationError):
        validate_permission_key(key)


def test_validate_role_name() -> None:
    assert validate_role_name("  Cashier  ") == "Cashier"


def test_validate_role_name_empty() -> None:
    with pytest.raises(ValidationError):
        validate_role_name("   ")


def test_derive_module_from_key() -> None:
    assert derive_module_from_key("inventory.create") == "inventory"
