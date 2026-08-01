"""LoginSession model — server-side user sessions (Identity Phase 4)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditedSoftDeleteModel


class LoginSession(AuditedSoftDeleteModel):
    """Revocable login session owning device/IP metadata and lifetime."""

    __tablename__ = "login_sessions"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", name="fk_login_sessions_user_id_users"),
        nullable=False,
        index=True,
    )
    device_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_activity_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    remember_me: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    user = relationship("User", lazy="selectin", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<LoginSession user_id={self.user_id} revoked={self.revoked_at is not None}>"
