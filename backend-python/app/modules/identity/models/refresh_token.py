"""RefreshToken model — opaque refresh tokens bound to a LoginSession."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditedSoftDeleteModel


class RefreshToken(AuditedSoftDeleteModel):
    """Server-side refresh token record (hash only; never store plaintext)."""

    __tablename__ = "refresh_tokens"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", name="fk_refresh_tokens_user_id_users"),
        nullable=False,
        index=True,
    )
    session_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("login_sessions.id", name="fk_refresh_tokens_session_id_login_sessions"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    replaced_by_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("refresh_tokens.id", name="fk_refresh_tokens_replaced_by_id"),
        nullable=True,
    )

    user = relationship("User", lazy="selectin", foreign_keys=[user_id])
    login_session = relationship("LoginSession", lazy="selectin", foreign_keys=[session_id])

    def __repr__(self) -> str:
        return (
            f"<RefreshToken session_id={self.session_id} "
            f"revoked={self.revoked_at is not None}>"
        )
