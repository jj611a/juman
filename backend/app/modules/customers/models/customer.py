"""Customer model — party for reservations, rentals, and sales."""

from __future__ import annotations

from datetime import date

from sqlalchemy import Boolean, Date, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import AuditedSoftDeleteModel


class Customer(AuditedSoftDeleteModel):
    """Store customer contact and identity details."""

    __tablename__ = "customers"
    __table_args__ = (
        Index(
            "uq_customers_number_alive",
            "customer_number",
            unique=True,
            postgresql_where=text("is_deleted = false"),
            sqlite_where=text("is_deleted = 0"),
        ),
    )

    customer_number: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    alternative_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    national_id: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
        index=True,
    )

    def __repr__(self) -> str:
        return (
            f"<Customer customer_number={self.customer_number!r} "
            f"full_name={self.full_name!r} phone={self.phone!r}>"
        )
