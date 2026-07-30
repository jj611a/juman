"""Service-layer tests for RBAC."""

import pytest
from app.exceptions import BusinessError, ConflictError, NotFoundError, ValidationError
from app.modules.rbac.constants import SystemRoleName
from app.modules.rbac.defaults import ALL_PERMISSION_KEYS
from app.modules.rbac.services.permission import PermissionService
from app.modules.rbac.services.role import RoleService


@pytest.mark.asyncio
async def test_ensure_defaults_seeds_permissions_and_roles(role_service: RoleService) -> None:
    permissions = await role_service.permission_service.list_permissions()
    roles = await role_service.list_roles()
    assert len(permissions) == len(ALL_PERMISSION_KEYS)
    assert {role.name for role in roles} >= {
        SystemRoleName.ADMIN,
        SystemRoleName.CASHIER,
        SystemRoleName.INVENTORY,
        SystemRoleName.LAUNDRY,
    }


@pytest.mark.asyncio
async def test_ensure_defaults_is_idempotent(role_service: RoleService) -> None:
    result = await role_service.ensure_defaults()
    assert result["permissions"] == 0
    assert result["roles"] == 0


@pytest.mark.asyncio
async def test_get_permission_by_key(permission_service: PermissionService) -> None:
    permission = await permission_service.get_by_key("inventory.view")
    assert permission.module == "inventory"
    assert permission.display_name


@pytest.mark.asyncio
async def test_create_duplicate_permission_conflicts(
    permission_service: PermissionService,
) -> None:
    with pytest.raises(ConflictError):
        await permission_service.create_permission(
            key="inventory.view",
            display_name="عرض",
        )


@pytest.mark.asyncio
async def test_create_and_lookup_custom_permission(
    permission_service: PermissionService,
) -> None:
    created = await permission_service.create_permission(
        key="custom.action",
        display_name="إجراء مخصص",
        description="اختبار",
    )
    found = await permission_service.get_by_key("custom.action")
    assert found.id == created.id
    assert found.module == "custom"


@pytest.mark.asyncio
async def test_admin_has_inventory_view(role_service: RoleService) -> None:
    admin = await role_service.get_by_name(SystemRoleName.ADMIN)
    assert await role_service.role_has_permission(admin.id, "inventory.view") is True


@pytest.mark.asyncio
async def test_assign_and_remove_permission(role_service: RoleService) -> None:
    role = await role_service.create_role(name="TempRole", description="temp")
    await role_service.assign_permissions(role.id, ["reports.view"])
    assert await role_service.role_has_permission(role.id, "reports.view") is True

    permission = await role_service.permission_service.get_by_key("reports.view")
    await role_service.remove_permission(role.id, permission.id)
    assert await role_service.role_has_permission(role.id, "reports.view") is False


@pytest.mark.asyncio
async def test_cannot_delete_system_role(role_service: RoleService) -> None:
    admin = await role_service.get_by_name(SystemRoleName.ADMIN)
    with pytest.raises(BusinessError) as exc_info:
        await role_service.delete_role(admin.id)
    assert exc_info.value.code == "system_role_immutable"


@pytest.mark.asyncio
async def test_cannot_rename_system_role(role_service: RoleService) -> None:
    admin = await role_service.get_by_name(SystemRoleName.ADMIN)
    with pytest.raises(BusinessError):
        await role_service.update_role(admin.id, name="SuperAdmin")


@pytest.mark.asyncio
async def test_assign_missing_permission_raises(role_service: RoleService) -> None:
    role = await role_service.create_role(name="AnotherTemp")
    with pytest.raises(NotFoundError):
        await role_service.assign_permissions(role.id, ["does.not.exist"])


@pytest.mark.asyncio
async def test_invalid_permission_key_on_create(permission_service: PermissionService) -> None:
    with pytest.raises(ValidationError):
        await permission_service.create_permission(key="badkey", display_name="x")
