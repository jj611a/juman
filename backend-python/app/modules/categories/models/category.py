"""Category model — organizational label for dresses (no business logic)."""

from __future__ import annotations

from sqlalchemy import Boolean, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import AuditedSoftDeleteModel


class Category(AuditedSoftDeleteModel):
    """Classification label used to group dresses."""

    __tablename__ = "categories"
    __table_args__ = (
        Index(
            "uq_categories_name_ar_alive",
            "name_ar",
            unique=True,
            postgresql_where=text("is_deleted = false"),
            sqlite_where=text("is_deleted = 0"),
        ),
    )

    name_ar: Mapped[str] = mapped_column(String(200), nullable=False)
    name_en: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
        index=True,
    )

    def __repr__(self) -> str:
        return f"<Category name_ar={self.name_ar!r} active={self.is_active}>"
