"""RefreshToken repository — Identity Phase 3."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.models.refresh_token import RefreshToken
from app.repositories.base import AsyncRepository


class RefreshTokenRepository(AsyncRepository[RefreshToken]):
    """Persistence helpers for refresh tokens."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, RefreshToken)

    async def get_by_token_hash(
        self,
        token_hash: str,
        *,
        include_deleted: bool = False,
    ) -> RefreshToken | None:
        """Fetch a refresh token row by stored hash."""
        stmt = self._base_query(include_deleted=include_deleted).where(
            RefreshToken.token_hash == token_hash
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_active_for_user(self, user_id: UUID) -> list[RefreshToken]:
        """List non-deleted, non-revoked refresh tokens for a user."""
        stmt = (
            self._base_query(include_deleted=False)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
            )
            .order_by(RefreshToken.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_active_for_session(self, session_id: UUID) -> list[RefreshToken]:
        """List non-deleted, non-revoked refresh tokens for a login session."""
        stmt = (
            self._base_query(include_deleted=False)
            .where(
                RefreshToken.session_id == session_id,
                RefreshToken.revoked_at.is_(None),
            )
            .order_by(RefreshToken.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
