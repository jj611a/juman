"""Immutable sale line items (unique dresses)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.mixins import AuditMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.database.base import Base


class SaleItem(UUIDPrimaryKeyMixin, TimestampMixin, AuditMixin, Base):
    """Append-only sale line for one physical dress."""

    __tablename__ = "sale_items"
    __table_args__ = (
        Index("ix_sale_items_sale_id", "sale_id"),
        Index(
            "uq_sale_items_dress_completed",
            "dress_id",
            unique=True,
        ),
        Index(
            "uq_sale_items_inspection_item",
            "inspection_item_id",
            unique=True,
            postgresql_where=text("inspection_item_id IS NOT NULL"),
            sqlite_where=text("inspection_item_id IS NOT NULL"),
        ),
    )

    sale_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("sales.id", name="fk_sale_items_sale_id_sales", ondelete="RESTRICT"),
        nullable=False,
    )
    dress_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("dresses.id", name="fk_sale_items_dress_id_dresses", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    default_sale_price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    actual_sale_price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    inspection_item_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "inspection_items.id",
            name="fk_sale_items_inspection_item_id",
            ondelete="RESTRICT",
        ),
        nullable=True,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    sale = relationship("Sale", back_populates="items", lazy="selectin")

    def __repr__(self) -> str:
        return (
            f"<SaleItem dress_id={self.dress_id!r} "
            f"actual={self.actual_sale_price!r}>"
        )
