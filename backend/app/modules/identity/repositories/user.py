"""User repository — Phase 1."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.models.user import User
from app.repositories.base import AsyncRepository


class UserRepository(AsyncRepository[User]):
    """Persistence helpers for users."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, User)

    async def get_by_username(
        self,
        username: str,
        *,
        include_deleted: bool = False,
    ) -> User | None:
        """Fetch a user by normalized username."""
        stmt = self._base_query(include_deleted=include_deleted).where(
            User.username == username.lower()
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def count_active_admins(
        self,
        *,
        admin_role_id: UUID,
        exclude_user_id: UUID | None = None,
    ) -> int:
        """Count active non-deleted users holding the Admin role."""
        stmt = select(func.count()).select_from(User).where(
            User.is_deleted.is_(False),
            User.is_active.is_(True),
            User.role_id == admin_role_id,
        )
        if exclude_user_id is not None:
            stmt = stmt.where(User.id != exclude_user_id)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())
