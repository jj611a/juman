"""Role persistence operations."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.rbac.models.role import Role
from app.modules.rbac.models.role_permission import RolePermission
from app.repositories.base import AsyncRepository


class RoleRepository(AsyncRepository[Role]):
    """Repository for ``Role`` entities."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Role)

    async def get_by_name(self, name: str, *, include_deleted: bool = False) -> Role | None:
        """Fetch a role by unique name."""
        stmt = self._base_query(include_deleted=include_deleted).where(Role.name == name)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id_with_permissions(
        self,
        role_id,
        *,
        include_deleted: bool = False,
    ) -> Role | None:
        """Fetch a role and eagerly load active role-permission links."""
        stmt = (
            self._base_query(include_deleted=include_deleted)
            .where(Role.id == role_id)
            .options(
                selectinload(Role.role_permissions).selectinload(RolePermission.permission),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(
        self,
        *,
        active_only: bool = False,
        include_deleted: bool = False,
    ) -> list[Role]:
        """List roles ordered by name."""
        stmt = self._base_query(include_deleted=include_deleted).order_by(Role.name.asc())
        if active_only:
            stmt = stmt.where(Role.is_active.is_(True))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_names(self, *, include_deleted: bool = False) -> set[str]:
        """Return existing role names."""
        stmt = select(Role.name)
        if not include_deleted:
            stmt = stmt.where(Role.is_deleted.is_(False))
        result = await self.session.execute(stmt)
        return set(result.scalars().all())
