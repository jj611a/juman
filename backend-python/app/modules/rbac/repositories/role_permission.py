"""RolePermission persistence operations."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.rbac.models.role_permission import RolePermission
from app.repositories.base import AsyncRepository


class RolePermissionRepository(AsyncRepository[RolePermission]):
    """Repository for role–permission associations."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, RolePermission)

    async def get_link(
        self,
        role_id: UUID,
        permission_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> RolePermission | None:
        """Fetch a specific role-permission association."""
        stmt = self._base_query(include_deleted=include_deleted).where(
            RolePermission.role_id == role_id,
            RolePermission.permission_id == permission_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_role(
        self,
        role_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> list[RolePermission]:
        """List permission links for a role with permission entities loaded."""
        stmt = (
            self._base_query(include_deleted=include_deleted)
            .where(RolePermission.role_id == role_id)
            .options(selectinload(RolePermission.permission))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_permission_keys_for_role(self, role_id: UUID) -> set[str]:
        """Return active permission keys assigned to a role."""
        from app.modules.rbac.models.permission import Permission

        stmt = (
            select(Permission.key)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(
                RolePermission.role_id == role_id,
                RolePermission.is_deleted.is_(False),
                Permission.is_deleted.is_(False),
            )
        )
        result = await self.session.execute(stmt)
        return set(result.scalars().all())
