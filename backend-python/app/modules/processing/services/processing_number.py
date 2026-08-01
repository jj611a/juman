"""ProcessingNumberService — immutable PRC-######## issuance."""

from __future__ import annotations

import re
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ValidationError
from app.modules.inventory.repositories.barcode_counter import BarcodeCounterRepository
from app.modules.processing.repositories.processing import ProcessingBatchRepository
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.services.base import BaseService

_PREFIX_RE = re.compile(r"^[A-Z0-9]+$")
_ALLOWED_SEPARATORS = frozenset({"", "-", "_"})


@dataclass(frozen=True, slots=True)
class ProcessingNumberConfig:
    prefix: str
    separator: str
    padding: int


class ProcessingNumberService(BaseService):
    """Generate processing batch numbers."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        settings: SettingService | None = None,
        batches: ProcessingBatchRepository | None = None,
        counters: BarcodeCounterRepository | None = None,
    ) -> None:
        super().__init__(session)
        self.settings = settings or SettingService(session)
        self.batches = batches or ProcessingBatchRepository(session)
        self.counters = counters or BarcodeCounterRepository(session)

    async def load_config(self) -> ProcessingNumberConfig:
        prefix = (
            await self.settings.get_string(SettingKey.PROCESSING_NUMBER_PREFIX.value)
        ).strip().upper()
        separator = await self.settings.get_string(SettingKey.PROCESSING_NUMBER_SEPARATOR.value)
        padding = await self.settings.get_int(SettingKey.PROCESSING_NUMBER_PADDING.value)
        if not prefix or not _PREFIX_RE.fullmatch(prefix):
            raise ValidationError(
                "إعداد بادئة رقم المعالجة غير صالح",
                details={"field": "processing.number.prefix"},
            )
        if separator not in _ALLOWED_SEPARATORS:
            raise ValidationError(
                "إعداد فاصل رقم المعالجة غير صالح",
                details={"field": "processing.number.separator"},
            )
        if padding < 1 or padding > 16:
            raise ValidationError(
                "إعداد حشو رقم المعالجة غير صالح",
                details={"field": "processing.number.padding"},
            )
        return ProcessingNumberConfig(prefix=prefix, separator=separator, padding=padding)

    def format(self, sequence: int, *, config: ProcessingNumberConfig) -> str:
        if sequence < 1:
            raise ValidationError("رقم تسلسل المعالجة يجب أن يكون أكبر من صفر")
        body = str(sequence).zfill(config.padding)
        if len(body) > config.padding:
            raise ValidationError("رقم تسلسل المعالجة يتجاوز الحشو المحدد")
        return f"{config.prefix}{config.separator}{body}"

    async def exists(
        self,
        processing_number: str,
        *,
        exclude_id: UUID | None = None,
        include_deleted: bool = True,
    ) -> bool:
        found = await self.batches.get_by_processing_number(
            processing_number,
            exclude_id=exclude_id,
            include_deleted=include_deleted,
        )
        return found is not None

    async def generate_next(self) -> str:
        config = await self.load_config()
        counter = await self.counters.get_or_create_for_update(config.prefix)
        next_value = int(counter.last_value) + 1
        while True:
            candidate = self.format(next_value, config=config)
            if not await self.exists(candidate, include_deleted=True):
                break
            next_value += 1
            if next_value > 10**config.padding:
                raise ValidationError("تم استنفاد أرقام تسلسل المعالجة")
        await self.counters.save(counter, last_value=next_value)
        return candidate
