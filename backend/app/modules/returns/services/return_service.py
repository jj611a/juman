"""ReturnService — record full physical return of an ACTIVE rental."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.inventory.constants import DressStatus
from app.modules.inventory.services.dress_status import DressStatusService
from app.modules.rentals.constants import RentalStatus
from app.modules.rentals.services.rental import RentalService
from app.modules.returns.constants import ReturnSortField, ReturnStatus
from app.modules.returns.models.return_item import ReturnItem
from app.modules.returns.models.return_record import Return
from app.modules.returns.repositories.return_record import ReturnItemRepository, ReturnRepository
from app.modules.returns.services.return_number import ReturnNumberService
from app.modules.settings.services.setting import SettingService
from app.services.base import BaseService
from app.utils.datetime import ensure_utc, utc_now


def _snapshot(record: Return, items: list[ReturnItem] | None = None) -> dict[str, Any]:
    live = items if items is not None else [i for i in (record.items or []) if not i.is_deleted]
    return {
        "return_number": record.return_number,
        "rental_id": str(record.rental_id),
        "customer_id": str(record.customer_id),
        "returned_at": ensure_utc(record.returned_at).isoformat(),
        "status": record.status,
        "returned_by": str(record.returned_by) if record.returned_by else None,
        "notes": record.notes,
        "items": [
            {
                "id": str(item.id),
                "rental_item_id": str(item.rental_item_id),
                "dress_id": str(item.dress_id),
                "returned_at": ensure_utc(item.returned_at).isoformat(),
            }
            for item in live
        ],
    }


def _normalize_notes(notes: str | None, *, max_length: int, field: str) -> str | None:
    if notes is None:
        return None
    stripped = notes.strip()
    if not stripped:
        return None
    if len(stripped) > max_length:
        raise ValidationError(
            "الملاحظات أطول من الحد المسموح",
            details={"field": field, "max_length": max_length},
        )
    return stripped


class ReturnService(BaseService):
    """Create PENDING_INSPECTION returns from ACTIVE rentals."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        returns: ReturnRepository | None = None,
        items: ReturnItemRepository | None = None,
        numbers: ReturnNumberService | None = None,
        rentals: RentalService | None = None,
        dress_status: DressStatusService | None = None,
        settings: SettingService | None = None,
        audit: AuditService | None = None,
    ) -> None:
        super().__init__(session)
        self.returns = returns or ReturnRepository(session)
        self.items = items or ReturnItemRepository(session)
        self.settings = settings or SettingService(session)
        self.numbers = numbers or ReturnNumberService(
            session,
            settings=self.settings,
            returns=self.returns,
        )
        audit_svc = audit or AuditService(session)
        self.dress_status = dress_status or DressStatusService(session, audit=audit_svc)
        self.rentals = rentals or RentalService(
            session,
            settings=self.settings,
            dress_status=self.dress_status,
            audit=audit_svc,
        )
        self.audit = audit_svc

    async def get(self, return_id: UUID) -> Return:
        record = await self.returns.get_by_id(return_id)
        if record is None:
            raise NotFoundError("سجل الإرجاع غير موجود")
        self.session.expire(record, ["items"])
        await self.session.refresh(record, attribute_names=["items"])
        return record

    async def list(
        self,
        *,
        status: str | None = None,
        customer_id: UUID | None = None,
        rental_id: UUID | None = None,
        sort_by: ReturnSortField | str = ReturnSortField.CREATED_AT,
        sort_dir: str = "desc",
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Return], int]:
        allowed = {field.value for field in ReturnSortField}
        sort_key = str(sort_by)
        if sort_key not in allowed:
            raise ValidationError(
                "حقل الترتيب غير صالح",
                details={"sort_by": sort_key, "allowed": sorted(allowed)},
            )
        direction = sort_dir.lower()
        if direction not in {"asc", "desc"}:
            raise ValidationError("اتجاه الترتيب غير صالح", details={"sort_dir": sort_dir})
        if status is not None:
            try:
                status = ReturnStatus(status.strip().upper()).value
            except ValueError as exc:
                raise ValidationError(
                    "حالة الإرجاع غير صالحة",
                    details={"field": "status"},
                ) from exc
        rows = await self.returns.list_filtered(
            status=status,
            customer_id=customer_id,
            rental_id=rental_id,
            sort_by=sort_key,
            sort_dir=direction,
            offset=offset,
            limit=limit,
        )
        total = await self.returns.count_filtered(
            status=status,
            customer_id=customer_id,
            rental_id=rental_id,
        )
        return rows, total

    async def create(
        self,
        *,
        rental_id: UUID,
        customer_id: UUID | None = None,
        returned_at: datetime | None = None,
        notes: str | None = None,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Return:
        """Create a full return for an ACTIVE rental."""
        rental = await self.rentals.get(rental_id)

        existing = await self.returns.get_live_by_rental_id(rental.id)
        if existing is not None:
            raise ConflictError(
                "تم تسجيل إرجاع لهذا الإيجار مسبقاً",
                details={"rental_id": str(rental.id), "return_id": str(existing.id)},
            )

        if rental.status != RentalStatus.ACTIVE.value:
            raise ValidationError(
                "يمكن إرجاع عقود الإيجار النشطة فقط",
                details={"status": rental.status},
            )
        if customer_id is not None and customer_id != rental.customer_id:
            raise ValidationError(
                "عميل الإرجاع يجب أن يطابق عميل الإيجار",
                details={"field": "customer_id"},
            )

        live_items = [i for i in (rental.items or []) if not i.is_deleted]
        if not live_items:
            raise ValidationError("يجب أن يحتوي الإيجار على فستان واحد على الأقل")

        returned_at = returned_at or utc_now()
        if returned_at.tzinfo is None:
            raise ValidationError(
                "يجب أن يكون وقت الإرجاع بمنطقة زمنية",
                details={"field": "returned_at"},
            )
        returned_at = ensure_utc(returned_at)

        number = await self.numbers.generate_next()
        record = Return(
            return_number=number,
            rental_id=rental.id,
            customer_id=rental.customer_id,
            returned_at=returned_at,
            status=ReturnStatus.PENDING_INSPECTION.value,
            returned_by=actor_id,
            notes=_normalize_notes(notes, max_length=2000, field="notes"),
            created_by=actor_id,
            updated_by=actor_id,
        )
        record = await self.returns.add(record)

        created_items: list[ReturnItem] = []
        for rental_item in live_items:
            item = ReturnItem(
                return_id=record.id,
                rental_item_id=rental_item.id,
                dress_id=rental_item.dress_id,
                returned_at=returned_at,
                created_by=actor_id,
                updated_by=actor_id,
            )
            item = await self.items.add(item)
            created_items.append(item)

            await self.dress_status.change_status(
                rental_item.dress_id,
                DressStatus.INSPECTION,
                reason=f"إرجاع إيجار {rental.rental_number} → {record.return_number}",
                actor_id=actor_id,
                actor_username=actor_username,
                ip_address=ip_address,
            )

        await self.rentals.mark_return_pending(
            rental.id,
            actor_id=actor_id,
            actor_username=actor_username,
            ip_address=ip_address,
        )

        await self.audit.record_create(
            module="returns",
            entity_type="Return",
            entity_id=record.id,
            new_values=_snapshot(record, created_items),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="تم تسجيل عملية إرجاع",
        )
        self.session.expire(record, ["items"])
        return await self.get(record.id)

    async def mark_inspection_completed(
        self,
        return_id: UUID,
        *,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Return:
        """Mark a PENDING_INSPECTION return as INSPECTION_COMPLETED."""
        record = await self.get(return_id)
        if record.status != ReturnStatus.PENDING_INSPECTION.value:
            raise ValidationError(
                "يمكن إكمال فحص المرتجعات قيد انتظار الفحص فقط",
                details={"status": record.status},
            )
        old_values = _snapshot(record, [i for i in (record.items or []) if not i.is_deleted])
        record = await self.returns.update_fields(
            record,
            status=ReturnStatus.INSPECTION_COMPLETED.value,
            updated_by=actor_id,
            updated_at=utc_now(),
        )
        record = await self.get(record.id)
        await self.audit.record(
            module="returns",
            entity_type="Return",
            entity_id=record.id,
            action=AuditAction.COMPLETE,
            old_values=old_values,
            new_values=_snapshot(record, [i for i in (record.items or []) if not i.is_deleted]),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="اكتمل فحص المرتجع",
        )
        return record
