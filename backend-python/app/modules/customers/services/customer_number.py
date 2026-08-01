"""CustomerNumberService — immutable CUS-######## issuance."""

from __future__ import annotations

import re
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, ValidationError
from app.modules.customers.repositories.customer import CustomerRepository
from app.modules.inventory.repositories.barcode_counter import BarcodeCounterRepository
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.services.base import BaseService

_PREFIX_RE = re.compile(r"^[A-Z0-9]+$")
_ALLOWED_SEPARATORS = frozenset({"", "-", "_"})


@dataclass(frozen=True, slots=True)
class CustomerNumberConfig:
    """Active customer number format from Settings."""

    prefix: str
    separator: str
    padding: int


class CustomerNumberService(BaseService):
    """Generate and validate customer numbers (no regeneration API)."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        settings: SettingService | None = None,
        customers: CustomerRepository | None = None,
        counters: BarcodeCounterRepository | None = None,
    ) -> None:
        super().__init__(session)
        self.settings = settings or SettingService(session)
        self.customers = customers or CustomerRepository(session)
        self.counters = counters or BarcodeCounterRepository(session)

    async def load_config(self) -> CustomerNumberConfig:
        """Load and validate customer number format settings."""
        prefix = (
            await self.settings.get_string(SettingKey.CUSTOMERS_NUMBER_PREFIX.value)
        ).strip().upper()
        separator = await self.settings.get_string(SettingKey.CUSTOMERS_NUMBER_SEPARATOR.value)
        padding = await self.settings.get_int(SettingKey.CUSTOMERS_NUMBER_PADDING.value)

        if not prefix or not _PREFIX_RE.fullmatch(prefix):
            raise ValidationError(
                "إعداد بادئة رقم العميل غير صالح",
                details={"field": "customers.number.prefix"},
            )
        if separator not in _ALLOWED_SEPARATORS:
            raise ValidationError(
                "إعداد فاصل رقم العميل غير صالح",
                details={
                    "field": "customers.number.separator",
                    "allowed": sorted(_ALLOWED_SEPARATORS),
                },
            )
        if padding < 1 or padding > 16:
            raise ValidationError(
                "إعداد حشو رقم العميل غير صالح",
                details={"field": "customers.number.padding", "min": 1, "max": 16},
            )
        return CustomerNumberConfig(prefix=prefix, separator=separator, padding=padding)

    def format(self, sequence: int, *, config: CustomerNumberConfig) -> str:
        """Format a sequence number."""
        if sequence < 1:
            raise ValidationError("رقم تسلسل العميل يجب أن يكون أكبر من صفر")
        body = str(sequence).zfill(config.padding)
        if len(body) > config.padding:
            raise ValidationError(
                "رقم تسلسل العميل يتجاوز الحشو المحدد",
                details={"sequence": sequence, "padding": config.padding},
            )
        return f"{config.prefix}{config.separator}{body}"

    async def exists(
        self,
        customer_number: str,
        *,
        exclude_id: UUID | None = None,
        include_deleted: bool = True,
    ) -> bool:
        """Return True if any customer owns the number."""
        found = await self.customers.get_by_customer_number(
            customer_number,
            exclude_id=exclude_id,
            include_deleted=include_deleted,
        )
        return found is not None

    async def generate_next(self) -> str:
        """Allocate the next customer number under a row lock."""
        config = await self.load_config()
        counter = await self.counters.get_or_create_for_update(config.prefix)
        next_value = int(counter.last_value) + 1
        while True:
            candidate = self.format(next_value, config=config)
            if not await self.exists(candidate, include_deleted=True):
                break
            next_value += 1
            if next_value > 10**config.padding:
                raise ValidationError("تم استنفاد أرقام تسلسل العملاء")
        await self.counters.save(counter, last_value=next_value)
        return candidate

    async def ensure_unique(self, customer_number: str, *, exclude_id: UUID | None = None) -> None:
        """Raise ConflictError when the number is already used historically."""
        if await self.exists(customer_number, exclude_id=exclude_id, include_deleted=True):
            raise ConflictError("يوجد عميل بهذا الرقم مسبقاً")
