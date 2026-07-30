"""Role application service including permission assignment."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import BusinessError, ConflictError, NotFoundError, ValidationError
from app.modules.rbac.defaults import DEFAULT_ROLES
from app.modules.rbac.models.permission import Permission
from app.modules.rbac.models.role import Role
from app.modules.rbac.models.role_permission import RolePermission
from app.modules.rbac.repositories.permission import PermissionRepository
from app.modules.rbac.repositories.role import RoleRepository
from app.modules.rbac.repositories.role_permission import RolePermissionRepository
from app.modules.rbac.services.permission import PermissionService
from app.modules.rbac.validation import validate_role_name
from app.services.base import BaseService
from app.utils.datetime import utc_now


class RoleService(BaseService):
    """CRUD for roles and assignment of permissions."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        role_repository: RoleRepository | None = None,
        permission_repository: PermissionRepository | None = None,
        role_permission_repository: RolePermissionRepository | None = None,
        permission_service: PermissionService | None = None,
    ) -> None:
        super().__init__(session)
        self.roles = role_repository or RoleRepository(session)
        self.permissions = permission_repository or PermissionRepository(session)
        self.links = role_permission_repository or RolePermissionRepository(session)
        self.permission_service = permission_service or PermissionService(
            session,
            repository=self.permissions,
        )

    async def list_roles(self, *, active_only: bool = False) -> list[Role]:
        """List roles."""
        return await self.roles.list_all(active_only=active_only)

    async def get_by_id(self, role_id: UUID) -> Role:
        """Return a role by id."""
        role = await self.roles.get_by_id(role_id)
        if role is None:
            raise NotFoundError("الدور غير موجود", details={"id": str(role_id)})
        return role

    async def get_by_name(self, name: str) -> Role:
        """Return a role by name."""
        role = await self.roles.get_by_name(name)
        if role is None:
            raise NotFoundError("الدور غير موجود", details={"name": name})
        return role

    async def create_role(
        self,
        *,
        name: str,
        description: str | None = None,
        is_active: bool = True,
        permission_keys: list[str] | None = None,
        created_by: UUID | None = None,
    ) -> Role:
        """Create a custom (non-system) role and optionally assign permissions."""
        normalized = validate_role_name(name)
        existing = await self.roles.get_by_name(normalized)
        if existing is not None:
            raise ConflictError("اسم الدور موجود مسبقاً", details={"name": normalized})

        role = Role(
            name=normalized,
            description=description,
            is_system=False,
            is_active=is_active,
            created_by=created_by,
            updated_by=created_by,
        )
        role = await self.roles.add(role)
        if permission_keys:
            await self.assign_permissions(role.id, permission_keys, updated_by=created_by)
            role = await self.get_by_id(role.id)
        return role

    async def update_role(
        self,
        role_id: UUID,
        *,
        name: str | None = None,
        description: str | None = None,
        is_active: bool | None = None,
        updated_by: UUID | None = None,
    ) -> Role:
        """Update role fields. System roles cannot be renamed."""
        role = await self.get_by_id(role_id)
        if name is not None:
            normalized = validate_role_name(name)
            if role.is_system and normalized != role.name:
                raise BusinessError(
                    "لا يمكن إعادة تسمية أدوار النظام",
                    code="system_role_immutable",
                    status_code=403,
                    details={"role_id": str(role_id)},
                )
            conflict = await self.roles.get_by_name(normalized)
            if conflict is not None and conflict.id != role.id:
                raise ConflictError("اسم الدور موجود مسبقاً", details={"name": normalized})
            role.name = normalized
        if description is not None:
            role.description = description
        if is_active is not None:
            role.is_active = is_active
        role.updated_by = updated_by
        await self.session.flush()
        await self.session.refresh(role)
        return role

    async def delete_role(
        self,
        role_id: UUID,
        *,
        deleted_by: UUID | None = None,
    ) -> None:
        """Soft-delete a role. System roles cannot be deleted."""
        role = await self.get_by_id(role_id)
        if role.is_system:
            raise BusinessError(
                "لا يمكن حذف أدوار النظام",
                code="system_role_immutable",
                status_code=403,
                details={"role_id": str(role_id)},
            )
        await self.roles.delete(role, deleted_by=deleted_by)

    async def list_role_permissions(self, role_id: UUID) -> list[Permission]:
        """List permissions assigned to a role."""
        await self.get_by_id(role_id)
        links = await self.links.list_for_role(role_id)
        return [link.permission for link in links if link.permission is not None]

    async def assign_permissions(
        self,
        role_id: UUID,
        permission_keys: list[str],
        *,
        updated_by: UUID | None = None,
    ) -> list[Permission]:
        """Assign one or more permissions to a role (idempotent)."""
        if not permission_keys:
            raise ValidationError("يجب تحديد صلاحية واحدة على الأقل")

        role = await self.get_by_id(role_id)
        permissions = await self.permissions.get_by_keys(permission_keys)
        found_keys = {p.key for p in permissions}
        missing = sorted(set(permission_keys) - found_keys)
        if missing:
            raise NotFoundError(
                "بعض الصلاحيات غير موجودة",
                details={"missing_keys": missing},
            )

        for permission in permissions:
            existing = await self.links.get_link(role.id, permission.id, include_deleted=True)
            if existing is None:
                await self.links.add(
                    RolePermission(
                        role_id=role.id,
                        permission_id=permission.id,
                        created_by=updated_by,
                        updated_by=updated_by,
                    )
                )
            elif existing.is_deleted:
                existing.is_deleted = False
                existing.deleted_at = None
                existing.deleted_by = None
                existing.updated_by = updated_by
                existing.updated_at = utc_now()
                await self.session.flush()

        role.updated_by = updated_by
        await self.session.flush()
        return await self.list_role_permissions(role_id)

    async def remove_permission(
        self,
        role_id: UUID,
        permission_id: UUID,
        *,
        deleted_by: UUID | None = None,
    ) -> None:
        """Remove a permission assignment from a role."""
        await self.get_by_id(role_id)
        link = await self.links.get_link(role_id, permission_id)
        if link is None:
            raise NotFoundError(
                "الصلاحية غير مرتبطة بهذا الدور",
                details={"role_id": str(role_id), "permission_id": str(permission_id)},
            )
        await self.links.delete(link, deleted_by=deleted_by)

    async def remove_permission_by_key(
        self,
        role_id: UUID,
        permission_key: str,
        *,
        deleted_by: UUID | None = None,
    ) -> None:
        """Remove a permission assignment using the permission key."""
        permission = await self.permission_service.get_by_key(permission_key)
        await self.remove_permission(role_id, permission.id, deleted_by=deleted_by)

    async def role_has_permission(self, role_id: UUID, permission_key: str) -> bool:
        """Return True if the active role currently holds the permission key."""
        role = await self.roles.get_by_id(role_id)
        if role is None or not role.is_active:
            return False
        keys = await self.links.list_permission_keys_for_role(role_id)
        return permission_key in keys

    async def ensure_defaults(self) -> dict[str, int]:
        """
        Idempotently seed permissions, system roles, and assignments.

        Returns counts of newly created rows.
        """
        created_permissions = await self.permission_service.ensure_defaults()
        created_roles = 0
        created_links = 0

        for seed in DEFAULT_ROLES:
            role = await self.roles.get_by_name(seed.name)
            if role is None:
                role = await self.roles.add(
                    Role(
                        name=seed.name,
                        description=seed.description,
                        is_system=True,
                        is_active=True,
                    )
                )
                created_roles += 1

            before = await self.links.list_permission_keys_for_role(role.id)
            await self.assign_permissions(role.id, list(seed.permission_keys))
            after = await self.links.list_permission_keys_for_role(role.id)
            created_links += len(after - before)

        return {
            "permissions": len(created_permissions),
            "roles": created_roles,
            "role_permissions": created_links,
        }
