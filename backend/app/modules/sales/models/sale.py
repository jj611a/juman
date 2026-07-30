"""Sale header - atomic completed dress sales."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditedSoftDeleteModel


class Sale(AuditedSoftDeleteModel):
    """Posted sale of one or more unique dresses."""

    __tablename__ = "sales"
    __table_args__ = (
        Index(
            "uq_sales_number_alive",
            "sale_number",
            unique=True,
            postgresql_where=text("is_deleted = false"),
            sqlite_where=text("is_deleted = 0"),
        ),
    )

    sale_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    origin: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    customer_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("customers.id", name="fk_sales_customer_id_customers", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    rental_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("rentals.id", name="fk_sales_rental_id_rentals", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    return_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("returns.id", name="fk_sales_return_id_returns", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    inspection_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "inspections.id",
            name="fk_sales_inspection_id_inspections",
            ondelete="RESTRICT",
        ),
        nullable=True,
        index=True,
    )
    total_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sold_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sold_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    items = relationship("SaleItem", back_populates="sale", lazy="selectin")
    payments = relationship("SalePayment", back_populates="sale", lazy="selectin")

    def __repr__(self) -> str:
        return (
            f"<Sale number={self.sale_number!r} origin={self.origin!r} "
            f"status={self.status!r}>"
        )
