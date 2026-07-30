"""Dress model — serialized physical asset (Inventory Phase 1)."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    ForeignKey,
    Index,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditedSoftDeleteModel
from app.modules.inventory.constants import DressStatus


class Dress(AuditedSoftDeleteModel):
    """One unique physical dress asset (not quantity stock)."""

    __tablename__ = "dresses"
    __table_args__ = (
        Index(
            "uq_dresses_barcode_alive",
            "barcode",
            unique=True,
            postgresql_where=text("is_deleted = false"),
            sqlite_where=text("is_deleted = 0"),
        ),
    )

    barcode: Mapped[str] = mapped_column(String(64), nullable=False)
    category_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("categories.id", name="fk_dresses_category_id_categories", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name_ar: Mapped[str] = mapped_column(String(200), nullable=False)
    name_en: Mapped[str | None] = mapped_column(String(200), nullable=True)
    brand: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    size: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    colour: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    purchase_price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    default_daily_rental_price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    default_sale_price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=DressStatus.AVAILABLE.value,
        server_default=DressStatus.AVAILABLE.value,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
        index=True,
    )

    category = relationship("Category", lazy="selectin", foreign_keys=[category_id])

    def __repr__(self) -> str:
        return f"<Dress name_ar={self.name_ar!r} barcode={self.barcode!r} status={self.status!r}>"
