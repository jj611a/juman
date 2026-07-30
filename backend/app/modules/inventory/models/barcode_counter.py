"""Barcode sequence counter for dress barcode generation."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class BarcodeCounter(Base):
    """Per-prefix monotonic sequence used by BarcodeService."""

    __tablename__ = "barcode_counters"

    prefix: Mapped[str] = mapped_column(String(32), primary_key=True)
    last_value: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0, server_default="0")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    def __repr__(self) -> str:
        return f"<BarcodeCounter prefix={self.prefix!r} last_value={self.last_value}>"
