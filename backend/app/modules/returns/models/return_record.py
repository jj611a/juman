"""Return header — physical receipt of rented dresses."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditedSoftDeleteModel


class Return(AuditedSoftDeleteModel):
    """Full return of an ACTIVE rental into the inspection workflow."""

    __tablename__ = "returns"
    __table_args__ = (
        Index(
            "uq_returns_number_alive",
            "return_number",
            unique=True,
            postgresql_where=text("is_deleted = false"),
            sqlite_where=text("is_deleted = 0"),
        ),
        Index(
            "uq_returns_rental_id_alive",
            "rental_id",
            unique=True,
            postgresql_where=text("is_deleted = false"),
            sqlite_where=text("is_deleted = 0"),
        ),
    )

    return_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    rental_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("rentals.id", name="fk_returns_rental_id_rentals", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    customer_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("customers.id", name="fk_returns_customer_id_customers", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    returned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    returned_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    items = relationship(
        "ReturnItem",
        back_populates="return_record",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Return number={self.return_number!r} "
            f"status={self.status!r} rental_id={self.rental_id!r}>"
        )
