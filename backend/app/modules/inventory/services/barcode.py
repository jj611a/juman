"""BarcodeService — generation, validation, and lifetime uniqueness."""

from __future__ import annotations

import re
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, ValidationError
from app.modules.inventory.repositories.barcode_counter import BarcodeCounterRepository
from app.modules.inventory.repositories.dress import DressRepository
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.services.base import BaseService

_PREFIX_RE = re.compile(r"^[A-Z0-9]+$")
_ALLOWED_SEPARATORS = frozenset({"", "-", "_"})


@dataclass(frozen=True, slots=True)
class ParsedBarcode:
    """Structured barcode parts."""

    prefix: str
    separator: str
    sequence: int
    raw: str


@dataclass(frozen=True, slots=True)
class BarcodeFormatConfig:
    """Active barcode format from Settings."""

    prefix: str
    separator: str
    padding: int


class BarcodeService(BaseService):
    """Own dress barcode identity and format rules (no images / printers)."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        settings: SettingService | None = None,
        dresses: DressRepository | None = None,
        counters: BarcodeCounterRepository | None = None,
    ) -> None:
        super().__init__(session)
        self.settings = settings or SettingService(session)
        self.dresses = dresses or DressRepository(session)
        self.counters = counters or BarcodeCounterRepository(session)

    async def load_config(self) -> BarcodeFormatConfig:
        """Load and validate barcode format settings."""
        prefix = (await self.settings.get_string(SettingKey.INVENTORY_BARCODE_PREFIX.value)).strip().upper()
        separator = await self.settings.get_string(SettingKey.INVENTORY_BARCODE_SEPARATOR.value)
        padding = await self.settings.get_int(SettingKey.INVENTORY_BARCODE_PADDING.value)

        if not prefix or not _PREFIX_RE.fullmatch(prefix):
            raise ValidationError(
                "إعداد بادئة الباركود غير صالح",
                details={"field": "inventory.barcode.prefix"},
            )
        if separator not in _ALLOWED_SEPARATORS:
            raise ValidationError(
                "إعداد فاصل الباركود غير صالح",
                details={"field": "inventory.barcode.separator", "allowed": sorted(_ALLOWED_SEPARATORS)},
            )
        if padding < 1 or padding > 16:
            raise ValidationError(
                "إعداد حشو الباركود غير صالح",
                details={"field": "inventory.barcode.padding", "min": 1, "max": 16},
            )
        return BarcodeFormatConfig(prefix=prefix, separator=separator, padding=padding)

    def format(self, sequence: int, *, config: BarcodeFormatConfig) -> str:
        """Format a sequence number using the given format config."""
        if sequence < 1:
            raise ValidationError("رقم تسلسل الباركود يجب أن يكون أكبر من صفر")
        body = str(sequence).zfill(config.padding)
        if len(body) > config.padding:
            raise ValidationError(
                "رقم تسلسل الباركود يتجاوز الحشو المحدد",
                details={"sequence": sequence, "padding": config.padding},
            )
        return f"{config.prefix}{config.separator}{body}"

    async def format_sequence(self, sequence: int) -> str:
        """Format using live Settings."""
        return self.format(sequence, config=await self.load_config())

    def parse(self, value: str, *, config: BarcodeFormatConfig) -> ParsedBarcode:
        """Parse a barcode against the active format config."""
        raw = value.strip()
        if not raw:
            raise ValidationError("الباركود مطلوب", details={"field": "barcode"})

        escaped_sep = re.escape(config.separator)
        pattern = re.compile(
            rf"^{re.escape(config.prefix)}{escaped_sep}(\d{{{config.padding}}})$"
        )
        match = pattern.fullmatch(raw)
        if match is None:
            raise ValidationError(
                "صيغة الباركود غير مطابقة للإعدادات",
                details={
                    "field": "barcode",
                    "expected_pattern": (
                        f"{config.prefix}{config.separator}{'0' * config.padding}"
                    ),
                    "prefix": config.prefix,
                    "separator": config.separator,
                    "padding": config.padding,
                },
            )
        digits = match.group(1)
        return ParsedBarcode(
            prefix=config.prefix,
            separator=config.separator,
            sequence=int(digits),
            raw=raw,
        )

    async def validate(
        self,
        value: str,
        *,
        exclude_id: UUID | None = None,
        check_unique: bool = True,
    ) -> str:
        """Validate format and optionally lifetime uniqueness; return normalized value."""
        config = await self.load_config()
        parsed = self.parse(value, config=config)
        if check_unique and await self.exists(
            parsed.raw,
            exclude_id=exclude_id,
            include_deleted=True,
        ):
            raise ConflictError("يوجد فستان بهذا الباركود مسبقاً")
        return parsed.raw

    async def exists(
        self,
        barcode: str,
        *,
        exclude_id: UUID | None = None,
        include_deleted: bool = True,
    ) -> bool:
        """Return True if any dress (optionally including soft-deleted) owns the barcode."""
        found = await self.dresses.get_by_barcode(
            barcode,
            exclude_id=exclude_id,
            include_deleted=include_deleted,
        )
        return found is not None

    async def generate_next(self) -> str:
        """Allocate the next barcode under a row lock for the configured prefix."""
        config = await self.load_config()
        counter = await self.counters.get_or_create_for_update(config.prefix)
        next_value = int(counter.last_value) + 1
        while True:
            candidate = self.format(next_value, config=config)
            if not await self.exists(candidate, include_deleted=True):
                break
            next_value += 1
            if next_value > 10**config.padding:
                raise ValidationError("تم استنفاد أرقام تسلسل الباركود")
        await self.counters.save(counter, last_value=next_value)
        return candidate

    async def bump_counter_if_needed(self, barcode: str) -> None:
        """Advance counter when a manual barcode uses a higher sequence for the prefix."""
        config = await self.load_config()
        try:
            parsed = self.parse(barcode, config=config)
        except ValidationError:
            return
        if parsed.prefix != config.prefix:
            return
        counter = await self.counters.get_or_create_for_update(config.prefix)
        if parsed.sequence > int(counter.last_value):
            await self.counters.save(counter, last_value=parsed.sequence)
