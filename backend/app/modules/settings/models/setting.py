"""SQLAlchemy model for system settings."""

from sqlalchemy import Boolean, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import AuditedSoftDeleteModel
from app.modules.settings.enums import SettingCategory, SettingValueType


class Setting(AuditedSoftDeleteModel):
    """
    Configurable system/business setting.

    Values are stored as text and interpreted using ``value_type``.
    """

    __tablename__ = "settings"
    __table_args__ = (UniqueConstraint("key", name="uq_settings_key"),)

    key: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    value: Mapped[str] = mapped_column(Text, nullable=False, default="")
    value_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=SettingValueType.STRING.value,
    )
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default=SettingCategory.SYSTEM.value,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_editable: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    def __repr__(self) -> str:
        return f"<Setting key={self.key!r} type={self.value_type!r}>"
