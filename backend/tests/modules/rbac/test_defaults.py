"""Tests for RBAC seed catalog."""

from app.modules.rbac.constants import SystemRoleName
from app.modules.rbac.defaults import (
    ALL_PERMISSION_KEYS,
    DEFAULT_PERMISSIONS,
    DEFAULT_ROLES,
)


def test_required_example_permissions_exist() -> None:
    required = {
        "inventory.view",
        "inventory.create",
        "inventory.update",
        "inventory.delete",
        "rental.create",
        "rental.return",
        "reservation.create",
        "customer.create",
        "customer.update",
        "reports.view",
        "reports.financial.view",
        "system.view",
        "settings.update",
        "users.manage",
        "roles.manage",
    }
    assert required.issubset(set(ALL_PERMISSION_KEYS))


def test_system_roles_seeded() -> None:
    names = {role.name for role in DEFAULT_ROLES}
    assert names == {
        SystemRoleName.ADMIN,
        SystemRoleName.CASHIER,
        SystemRoleName.INVENTORY,
        SystemRoleName.LAUNDRY,
    }


def test_admin_has_all_permissions() -> None:
    admin = next(r for r in DEFAULT_ROLES if r.name == SystemRoleName.ADMIN)
    assert set(admin.permission_keys) == set(ALL_PERMISSION_KEYS)


def test_permission_keys_are_unique() -> None:
    keys = [p.key for p in DEFAULT_PERMISSIONS]
    assert len(keys) == len(set(keys))


def test_permission_modules_derived_from_keys() -> None:
    for permission in DEFAULT_PERMISSIONS:
        assert permission.module == permission.key.split(".", maxsplit=1)[0]
