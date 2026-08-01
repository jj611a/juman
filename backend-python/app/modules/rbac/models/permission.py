"""Permission SQLAlchemy model."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditedSoftDeleteModel

if TYPE_CHECKING:
    from app.modules.rbac.models.role_permission import RolePermission


class Permission(AuditedSoftDeleteModel):
    """
    Database-driven permission definition.

    Keys use dot notation (e.g. ``inventory.view``).
    """

    __tablename__ = "permissions"
    __table_args__ = (UniqueConstraint("key", name="uq_permissions_key"),)

    key: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    module: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    role_permissions: Mapped[list[RolePermission]] = relationship(
        "RolePermission",
        back_populates="permission",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Permission key={self.key!r}>"
