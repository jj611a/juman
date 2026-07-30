"""Application service for system settings.

Default settings are seeded exclusively by Alembic migrations.
This service only reads and updates existing settings rows.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import BusinessError, NotFoundError, ValidationError
from app.modules.settings.enums import SettingCategory, SettingValueType
from app.modules.settings.models.setting import Setting
from app.modules.settings.repositories.setting import SettingRepository
from app.modules.settings.validation import (
    deserialize_setting_value,
    serialize_setting_value,
    validate_setting_value,
)
from app.services.base import BaseService


class SettingService(BaseService):
    """Orchestrates setting reads, typed accessors, and updates."""

    def __init__(self, session: AsyncSession, repository: SettingRepository | None = None) -> None:
        super().__init__(session)
        self.repository = repository or SettingRepository(session)

    async def list_settings(
        self,
        *,
        category: SettingCategory | str | None = None,
    ) -> list[Setting]:
        """Return all active settings, optionally filtered by category."""
        if category is not None:
            try:
                category = SettingCategory(str(category))
            except ValueError as exc:
                raise ValidationError(
                    "فئة الإعداد غير صالحة",
                    details={"category": str(category)},
                ) from exc
        return await self.repository.list_all(category=category)

    async def get_by_key(self, key: str) -> Setting:
        """Return a setting by key or raise NotFoundError."""
        setting = await self.repository.get_by_key(key)
        if setting is None:
            raise NotFoundError(
                "الإعداد غير موجود",
                details={"key": key},
            )
        return setting

    async def update_setting(
        self,
        key: str,
        *,
        value: Any,
        description: str | None = None,
        updated_by: UUID | None = None,
    ) -> Setting:
        """
        Update a setting (PUT semantics).

        Updates ``value`` and optionally ``description``. Rejects non-editable
        settings.
        """
        setting = await self.get_by_key(key)
        self._assert_editable(setting)

        normalized = validate_setting_value(key, value, setting.value_type)
        setting.value = serialize_setting_value(normalized, setting.value_type)
        if description is not None:
            setting.description = description
        setting.updated_by = updated_by
        await self.session.flush()
        await self.session.refresh(setting)
        return setting

    async def update_value(
        self,
        key: str,
        value: Any,
        *,
        updated_by: UUID | None = None,
    ) -> Setting:
        """Update only the setting value (PATCH semantics)."""
        return await self.update_setting(key, value=value, updated_by=updated_by)

    async def get_typed(self, key: str) -> Any:
        """Return the deserialized value for a setting key."""
        setting = await self.get_by_key(key)
        return deserialize_setting_value(setting.value, setting.value_type)

    async def get_string(self, key: str) -> str:
        """Return a setting value as ``str``."""
        value = await self.get_typed(key)
        if not isinstance(value, str):
            raise BusinessError(
                "نوع الإعداد ليس نصاً",
                details={"key": key, "expected": SettingValueType.STRING.value},
            )
        return value

    async def get_int(self, key: str) -> int:
        """Return a setting value as ``int``."""
        value = await self.get_typed(key)
        if not isinstance(value, int) or isinstance(value, bool):
            raise BusinessError(
                "نوع الإعداد ليس عدداً صحيحاً",
                details={"key": key, "expected": SettingValueType.INTEGER.value},
            )
        return value

    async def get_float(self, key: str) -> float:
        """Return a setting value as ``float``."""
        value = await self.get_typed(key)
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise BusinessError(
                "نوع الإعداد ليس عدداً عشرياً",
                details={"key": key, "expected": SettingValueType.FLOAT.value},
            )
        return float(value)

    async def get_bool(self, key: str) -> bool:
        """Return a setting value as ``bool``."""
        value = await self.get_typed(key)
        if not isinstance(value, bool):
            raise BusinessError(
                "نوع الإعداد ليس منطقياً",
                details={"key": key, "expected": SettingValueType.BOOLEAN.value},
            )
        return value

    async def get_json(self, key: str) -> Any:
        """Return a setting value as parsed JSON."""
        setting = await self.get_by_key(key)
        if setting.value_type != SettingValueType.JSON.value:
            raise BusinessError(
                "نوع الإعداد ليس JSON",
                details={"key": key, "expected": SettingValueType.JSON.value},
            )
        return deserialize_setting_value(setting.value, SettingValueType.JSON)

    @staticmethod
    def _assert_editable(setting: Setting) -> None:
        if not setting.is_editable:
            raise BusinessError(
                "هذا الإعداد غير قابل للتعديل",
                code="setting_not_editable",
                status_code=403,
                details={"key": setting.key},
            )
