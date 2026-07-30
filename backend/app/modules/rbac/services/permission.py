"""Permission application service."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundError
from app.modules.rbac.defaults import DEFAULT_PERMISSIONS
from app.modules.rbac.models.permission import Permission
from app.modules.rbac.repositories.permission import PermissionRepository
from app.modules.rbac.validation import (
    derive_module_from_key,
    validate_permission_key,
)
from app.services.base import BaseService


class PermissionService(BaseService):
    """CRUD and lookup operations for permissions."""

    def __init__(
        self,
        session: AsyncSession,
        repository: PermissionRepository | None = None,
    ) -> None:
        super().__init__(session)
        self.repository = repository or PermissionRepository(session)

    async def list_permissions(self, *, module: str | None = None) -> list[Permission]:
        """List active permissions, optionally filtered by module."""
        return await self.repository.list_all(module=module)

    async def get_by_id(self, permission_id: UUID) -> Permission:
        """Return a permission by id or raise NotFoundError."""
        permission = await self.repository.get_by_id(permission_id)
        if permission is None:
            raise NotFoundError("الصلاحية غير موجودة", details={"id": str(permission_id)})
        return permission

    async def get_by_key(self, key: str) -> Permission:
        """Lookup a permission by key."""
        normalized = validate_permission_key(key)
        permission = await self.repository.get_by_key(normalized)
        if permission is None:
            raise NotFoundError("الصلاحية غير موجودة", details={"key": normalized})
        return permission

    async def create_permission(
        self,
        *,
        key: str,
        display_name: str,
        description: str | None = None,
        module: str | None = None,
        created_by: UUID | None = None,
    ) -> Permission:
        """Create a new permission definition."""
        normalized_key = validate_permission_key(key)
        existing = await self.repository.get_by_key(normalized_key)
        if existing is not None:
            raise ConflictError(
                "مفتاح الصلاحية موجود مسبقاً",
                details={"key": normalized_key},
            )
        display = display_name.strip()
        if not display:
            from app.exceptions import ValidationError

            raise ValidationError("اسم العرض مطلوب")

        entity = Permission(
            key=normalized_key,
            display_name=display,
            description=description,
            module=(module.strip() if module else derive_module_from_key(normalized_key)),
            created_by=created_by,
            updated_by=created_by,
        )
        return await self.repository.add(entity)

    async def update_permission(
        self,
        permission_id: UUID,
        *,
        display_name: str | None = None,
        description: str | None = None,
        module: str | None = None,
        updated_by: UUID | None = None,
    ) -> Permission:
        """Update mutable permission fields (key is immutable)."""
        permission = await self.get_by_id(permission_id)
        if display_name is not None:
            display = display_name.strip()
            if not display:
                from app.exceptions import ValidationError

                raise ValidationError("اسم العرض مطلوب")
            permission.display_name = display
        if description is not None:
            permission.description = description
        if module is not None:
            permission.module = module.strip()
        permission.updated_by = updated_by
        await self.session.flush()
        await self.session.refresh(permission)
        return permission

    async def delete_permission(
        self,
        permission_id: UUID,
        *,
        deleted_by: UUID | None = None,
    ) -> None:
        """Soft-delete a permission."""
        permission = await self.get_by_id(permission_id)
        await self.repository.delete(permission, deleted_by=deleted_by)

    async def ensure_defaults(self) -> list[Permission]:
        """Idempotently seed missing default permissions."""
        existing = await self.repository.list_keys()
        created: list[Permission] = []
        for seed in DEFAULT_PERMISSIONS:
            if seed.key in existing:
                continue
            entity = Permission(
                key=seed.key,
                display_name=seed.display_name,
                description=seed.description,
                module=seed.module,
            )
            created.append(await self.repository.add(entity))
        return created
