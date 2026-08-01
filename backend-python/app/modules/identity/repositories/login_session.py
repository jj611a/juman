"""LoginSession repository — Identity Phase 4."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.models.login_session import LoginSession
from app.repositories.base import AsyncRepository
from app.utils.datetime import ensure_utc, utc_now


class LoginSessionRepository(AsyncRepository[LoginSession]):
    """Persistence helpers for login sessions."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, LoginSession)

    async def list_active_for_user(self, user_id: UUID) -> list[LoginSession]:
        """List non-deleted, non-revoked, non-expired sessions for a user."""
        now = utc_now()
        stmt = (
            self._base_query(include_deleted=False)
            .where(
                LoginSession.user_id == user_id,
                LoginSession.revoked_at.is_(None),
            )
            .order_by(LoginSession.created_at.desc())
        )
        result = await self.session.execute(stmt)
        rows = list(result.scalars().all())
        return [row for row in rows if ensure_utc(row.expires_at) > now]
