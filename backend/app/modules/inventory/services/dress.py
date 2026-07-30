"""DressService — CRUD and activation for serialized dress assets."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import BusinessError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.categories.repositories.category import CategoryRepository
from app.modules.inventory.constants import DressSortField, DressStatus
from app.modules.inventory.models.dress import Dress
from app.modules.inventory.repositories.dress import DressRepository
from app.modules.inventory.services.barcode import BarcodeService
from app.modules.inventory.validators import (
    normalize_optional_text,
    validate_colour,
    validate_name_ar,
    validate_price,
    validate_size,
    validate_status,
)
from app.modules.settings.services.setting import SettingService
from app.services.base import BaseService
from app.utils.datetime import utc_now


def _snapshot(dress: Dress) -> dict[str, Any]:
    return {
        "barcode": dress.barcode,
        "category_id": str(dress.category_id),
        "name_ar": dress.name_ar,
        "name_en": dress.name_en,
        "brand": dress.brand,
        "size": dress.size,
        "colour": dress.colour,
        "purchase_price": dress.purchase_price,
        "default_daily_rental_price": dress.default_daily_rental_price,
        "default_sale_price": dress.default_sale_price,
        "status": dress.status,
        "is_active": dress.is_active,
        "purchase_date": dress.purchase_date.isoformat() if dress.purchase_date else None,
    }


class DressService(BaseService):
    """Manage dress asset master records (Inventory Phase 1–2)."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        repository: DressRepository | None = None,
        categories: CategoryRepository | None = None,
        settings: SettingService | None = None,
        barcodes: BarcodeService | None = None,
        audit: AuditService | None = None,
    ) -> None:
        super().__init__(session)
        self.dresses = repository or DressRepository(session)
        self.categories = categories or CategoryRepository(session)
        self.settings = settings or SettingService(session)
        self.barcodes = barcodes or BarcodeService(
            session,
            settings=self.settings,
            dresses=self.dresses,
        )
        self.audit = audit or AuditService(session)

    async def _require_category(self, category_id: UUID) -> None:
        category = await self.categories.get_by_id(category_id)
        if category is None:
            raise NotFoundError("التصنيف غير موجود")
        if not category.is_active:
            raise ValidationError(
                "التصنيف غير نشط",
                details={"field": "category_id"},
            )

    async def _has_business_history(self, dress_id: UUID) -> bool:
        """
        Return True when the dress participated in business transactions.

        Stub until reservations / rentals / sales modules exist.
        """
        _ = dress_id
        return False

    async def get_dress(self, dress_id: UUID) -> Dress:
        """Return a live dress or raise NotFoundError."""
        dress = await self.dresses.get_by_id(dress_id)
        if dress is None:
            raise NotFoundError("الفستان غير موجود")
        return dress

    async def get_dress_by_barcode(self, barcode: str) -> Dress:
        """Return a live dress by exact barcode or raise NotFoundError."""
        value = barcode.strip()
        if not value:
            raise ValidationError("الباركود مطلوب", details={"field": "barcode"})
        dress = await self.dresses.get_by_barcode(value, include_deleted=False)
        if dress is None:
            raise NotFoundError("الفستان غير موجود")
        return dress

    async def list_dresses(
        self,
        *,
        q: str | None = None,
        barcode: str | None = None,
        category_id: UUID | None = None,
        status: str | None = None,
        brand: str | None = None,
        size: str | None = None,
        colour: str | None = None,
        is_active: bool | None = None,
        purchase_price_min: int | None = None,
        purchase_price_max: int | None = None,
        rental_price_min: int | None = None,
        rental_price_max: int | None = None,
        sale_price_min: int | None = None,
        sale_price_max: int | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
        updated_from: datetime | None = None,
        updated_to: datetime | None = None,
        sort_by: DressSortField | str = DressSortField.CREATED_AT,
        sort_dir: str = "desc",
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[Dress], int]:
        """Search dresses with filters, sort, and page-based pagination."""
        if page < 1:
            raise ValidationError("رقم الصفحة يجب أن يكون 1 أو أكثر", details={"field": "page"})
        if page_size < 1 or page_size > 200:
            raise ValidationError(
                "حجم الصفحة يجب أن يكون بين 1 و 200",
                details={"field": "page_size"},
            )

        allowed = {field.value for field in DressSortField}
        sort_key = str(sort_by)
        if sort_key not in allowed:
            raise ValidationError(
                "حقل الترتيب غير صالح",
                details={"sort_by": sort_key, "allowed": sorted(allowed)},
            )
        direction = sort_dir.lower()
        if direction not in {"asc", "desc"}:
            raise ValidationError(
                "اتجاه الترتيب غير صالح",
                details={"sort_dir": sort_dir},
            )

        def _range(
            lo: int | None,
            hi: int | None,
            *,
            field_min: str,
            field_max: str,
        ) -> None:
            if lo is not None and lo < 0:
                raise ValidationError("الحد الأدنى للسعر غير صالح", details={"field": field_min})
            if hi is not None and hi < 0:
                raise ValidationError("الحد الأعلى للسعر غير صالح", details={"field": field_max})
            if lo is not None and hi is not None and lo > hi:
                raise ValidationError(
                    "نطاق السعر غير صالح",
                    details={"field_min": field_min, "field_max": field_max},
                )

        _range(
            purchase_price_min,
            purchase_price_max,
            field_min="purchase_price_min",
            field_max="purchase_price_max",
        )
        _range(
            rental_price_min,
            rental_price_max,
            field_min="rental_price_min",
            field_max="rental_price_max",
        )
        _range(
            sale_price_min,
            sale_price_max,
            field_min="sale_price_min",
            field_max="sale_price_max",
        )
        if created_from is not None and created_to is not None and created_from > created_to:
            raise ValidationError(
                "نطاق تاريخ الإنشاء غير صالح",
                details={"field_min": "created_from", "field_max": "created_to"},
            )
        if updated_from is not None and updated_to is not None and updated_from > updated_to:
            raise ValidationError(
                "نطاق تاريخ التحديث غير صالح",
                details={"field_min": "updated_from", "field_max": "updated_to"},
            )

        status_value = validate_status(status) if status else None
        size_value = validate_size(size) if size else None
        colour_value = validate_colour(colour) if colour else None
        barcode_value = barcode.strip() if barcode and barcode.strip() else None
        offset = (page - 1) * page_size

        filters = dict(
            q=q,
            barcode=barcode_value,
            category_id=category_id,
            status=status_value,
            brand=brand,
            size=size_value,
            colour=colour_value,
            is_active=is_active,
            purchase_price_min=purchase_price_min,
            purchase_price_max=purchase_price_max,
            rental_price_min=rental_price_min,
            rental_price_max=rental_price_max,
            sale_price_min=sale_price_min,
            sale_price_max=sale_price_max,
            created_from=created_from,
            created_to=created_to,
            updated_from=updated_from,
            updated_to=updated_to,
        )
        items = await self.dresses.list_filtered(
            **filters,
            sort_by=sort_key,
            sort_dir=direction,
            offset=offset,
            limit=page_size,
        )
        total = await self.dresses.count_filtered(**filters, sort_by=sort_key)
        return items, total

    async def create_dress(
        self,
        *,
        category_id: UUID,
        name_ar: str,
        size: str,
        colour: str,
        purchase_price: int,
        default_daily_rental_price: int,
        default_sale_price: int,
        barcode: str | None = None,
        name_en: str | None = None,
        brand: str | None = None,
        description: str | None = None,
        purchase_date: date | None = None,
        is_active: bool = True,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Dress:
        """Create a dress asset with auto or manual barcode.

        Status is always ``AVAILABLE``; further changes go through DressStatusService.
        """
        await self._require_category(category_id)

        manual = barcode is not None and bool(str(barcode).strip())
        if manual:
            barcode_value = await self.barcodes.validate(str(barcode))
            await self.barcodes.bump_counter_if_needed(barcode_value)
            barcode_event = AuditAction.BARCODE_MANUAL_OVERRIDE
        else:
            barcode_value = await self.barcodes.generate_next()
            barcode_event = AuditAction.BARCODE_GENERATED

        dress = Dress(
            barcode=barcode_value,
            category_id=category_id,
            name_ar=validate_name_ar(name_ar),
            name_en=normalize_optional_text(name_en, max_length=200),
            brand=normalize_optional_text(brand, max_length=200),
            size=validate_size(size),
            colour=validate_colour(colour),
            purchase_price=validate_price(purchase_price, field="purchase_price"),
            default_daily_rental_price=validate_price(
                default_daily_rental_price,
                field="default_daily_rental_price",
            ),
            default_sale_price=validate_price(default_sale_price, field="default_sale_price"),
            description=normalize_optional_text(description, max_length=10000),
            purchase_date=purchase_date,
            status=DressStatus.AVAILABLE.value,
            is_active=is_active,
            created_by=actor_id,
            updated_by=actor_id,
        )
        dress = await self.dresses.add(dress)
        await self.audit.record_create(
            module="inventory",
            entity_type="Dress",
            entity_id=dress.id,
            new_values=_snapshot(dress),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
        )
        await self.audit.record(
            module="inventory",
            entity_type="Dress",
            entity_id=dress.id,
            action=barcode_event,
            new_values={"barcode": dress.barcode},
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            metadata={"source": "create", "manual": manual},
        )
        return dress

    async def set_barcode(
        self,
        dress_id: UUID,
        *,
        barcode: str | None = None,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Dress:
        """Change or regenerate barcode (Admin API). Blocked when business history exists."""
        dress = await self.get_dress(dress_id)
        if await self._has_business_history(dress_id):
            raise BusinessError(
                "لا يمكن تغيير باركود فستان له معاملات تجارية",
                code="barcode_locked",
                status_code=409,
                details={"dress_id": str(dress_id)},
            )

        old_values = _snapshot(dress)
        manual = barcode is not None and bool(str(barcode).strip())
        if manual:
            barcode_value = await self.barcodes.validate(str(barcode), exclude_id=dress_id)
            await self.barcodes.bump_counter_if_needed(barcode_value)
            action = AuditAction.BARCODE_MANUAL_OVERRIDE
        else:
            barcode_value = await self.barcodes.generate_next()
            action = AuditAction.BARCODE_CHANGED

        dress = await self.dresses.update_fields(
            dress,
            barcode=barcode_value,
            updated_by=actor_id,
            updated_at=utc_now(),
        )
        await self.audit.record(
            module="inventory",
            entity_type="Dress",
            entity_id=dress.id,
            action=action,
            old_values={"barcode": old_values["barcode"]},
            new_values={"barcode": dress.barcode},
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            metadata={"source": "set_barcode", "manual": manual, "regenerated": not manual},
        )
        return dress

    async def update_dress(
        self,
        dress_id: UUID,
        *,
        category_id: UUID | None = None,
        name_ar: str | None = None,
        name_en: str | None = None,
        brand: str | None = None,
        size: str | None = None,
        colour: str | None = None,
        purchase_price: int | None = None,
        default_daily_rental_price: int | None = None,
        default_sale_price: int | None = None,
        description: str | None = None,
        purchase_date: date | None = None,
        is_active: bool | None = None,
        clear_purchase_date: bool = False,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Dress:
        """Update mutable dress fields (barcode and status excluded)."""
        dress = await self.get_dress(dress_id)
        old_values = _snapshot(dress)

        fields: dict[str, object] = {
            "updated_by": actor_id,
            "updated_at": utc_now(),
        }
        if category_id is not None:
            await self._require_category(category_id)
            fields["category_id"] = category_id
        if name_ar is not None:
            fields["name_ar"] = validate_name_ar(name_ar)
        if name_en is not None:
            fields["name_en"] = normalize_optional_text(name_en, max_length=200)
        if brand is not None:
            fields["brand"] = normalize_optional_text(brand, max_length=200)
        if size is not None:
            fields["size"] = validate_size(size)
        if colour is not None:
            fields["colour"] = validate_colour(colour)
        if purchase_price is not None:
            fields["purchase_price"] = validate_price(purchase_price, field="purchase_price")
        if default_daily_rental_price is not None:
            fields["default_daily_rental_price"] = validate_price(
                default_daily_rental_price,
                field="default_daily_rental_price",
            )
        if default_sale_price is not None:
            fields["default_sale_price"] = validate_price(
                default_sale_price,
                field="default_sale_price",
            )
        if description is not None:
            fields["description"] = normalize_optional_text(description, max_length=10000)
        if clear_purchase_date:
            fields["purchase_date"] = None
        elif purchase_date is not None:
            fields["purchase_date"] = purchase_date
        if is_active is not None:
            fields["is_active"] = is_active

        dress = await self.dresses.update_fields(dress, **fields)
        await self.audit.record_update(
            module="inventory",
            entity_type="Dress",
            entity_id=dress.id,
            old_values=old_values,
            new_values=_snapshot(dress),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
        )
        return dress

    async def activate(
        self,
        dress_id: UUID,
        *,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Dress:
        """Set is_active=true."""
        dress = await self.get_dress(dress_id)
        old_values = _snapshot(dress)
        dress = await self.dresses.update_fields(
            dress,
            is_active=True,
            updated_by=actor_id,
            updated_at=utc_now(),
        )
        await self.audit.record(
            module="inventory",
            entity_type="Dress",
            entity_id=dress.id,
            action=AuditAction.ACTIVATE,
            old_values=old_values,
            new_values=_snapshot(dress),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
        )
        return dress

    async def deactivate(
        self,
        dress_id: UUID,
        *,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Dress:
        """Set is_active=false."""
        dress = await self.get_dress(dress_id)
        old_values = _snapshot(dress)
        dress = await self.dresses.update_fields(
            dress,
            is_active=False,
            updated_by=actor_id,
            updated_at=utc_now(),
        )
        await self.audit.record(
            module="inventory",
            entity_type="Dress",
            entity_id=dress.id,
            action=AuditAction.DEACTIVATE,
            old_values=old_values,
            new_values=_snapshot(dress),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
        )
        return dress

    async def soft_delete(
        self,
        dress_id: UUID,
        *,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> None:
        """Soft-delete a dress (barcode remains reserved historically)."""
        dress = await self.get_dress(dress_id)
        old_values = _snapshot(dress)
        await self.dresses.delete(dress, deleted_by=actor_id)
        await self.audit.record_delete(
            module="inventory",
            entity_type="Dress",
            entity_id=dress_id,
            old_values=old_values,
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            soft=True,
        )
