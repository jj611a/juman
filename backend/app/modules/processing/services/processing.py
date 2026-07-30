"""ProcessingService — post-inspection laundry / readiness workflow."""

from __future__ import annotations

from datetime import timedelta
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.calendar.constants import CalendarBlockType
from app.modules.calendar.services.calendar import CalendarService
from app.modules.inspection.constants import DressCondition, InspectionStatus
from app.modules.inspection.models.inspection_item import InspectionItem
from app.modules.inspection.repositories.inspection import (
    InspectionItemRepository,
    InspectionRepository,
)
from app.modules.inventory.constants import DressStatus
from app.modules.inventory.services.dress_status import DressStatusService
from app.modules.processing.constants import ProcessingSortField, ProcessingStatus
from app.modules.processing.models.processing_batch import ProcessingBatch
from app.modules.processing.models.processing_item import ProcessingItem
from app.modules.processing.repositories.processing import (
    ProcessingBatchRepository,
    ProcessingItemRepository,
)
from app.modules.processing.services.processing_number import ProcessingNumberService
from app.modules.rentals.repositories.rental import RentalItemRepository
from app.modules.returns.repositories.return_record import ReturnItemRepository
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.services.base import BaseService
from app.utils.datetime import ensure_utc, utc_now


def _snapshot(batch: ProcessingBatch, items: list[ProcessingItem] | None = None) -> dict[str, Any]:
    live = items if items is not None else [i for i in (batch.items or []) if not i.is_deleted]
    return {
        "processing_number": batch.processing_number,
        "status": batch.status,
        "started_at": (
            ensure_utc(batch.started_at).isoformat() if batch.started_at else None
        ),
        "mandatory_processing_end_at": (
            ensure_utc(batch.mandatory_processing_end_at).isoformat()
            if batch.mandatory_processing_end_at
            else None
        ),
        "optional_extra_day_enabled": batch.optional_extra_day_enabled,
        "final_processing_end_at": (
            ensure_utc(batch.final_processing_end_at).isoformat()
            if batch.final_processing_end_at
            else None
        ),
        "completed_at": (
            ensure_utc(batch.completed_at).isoformat() if batch.completed_at else None
        ),
        "notes": batch.notes,
        "items": [
            {
                "id": str(item.id),
                "dress_id": str(item.dress_id),
                "inspection_item_id": str(item.inspection_item_id),
                "return_item_id": str(item.return_item_id),
                "rental_item_id": str(item.rental_item_id),
                "calendar_block_id": (
                    str(item.calendar_block_id) if item.calendar_block_id else None
                ),
                "status": item.status,
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


def _final_end(*, mandatory_end, optional_enabled: bool, optional_days: int):
    if optional_enabled:
        return mandatory_end + timedelta(days=optional_days)
    return mandatory_end


def _calendar_end(started_at, final_end):
    """Calendar requires end > start; zero-day windows get a 1s sentinel block."""
    if final_end > started_at:
        return final_end
    return started_at + timedelta(seconds=1)


class ProcessingService(BaseService):
    """Create, start, extend, and complete processing batches."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        batches: ProcessingBatchRepository | None = None,
        items: ProcessingItemRepository | None = None,
        numbers: ProcessingNumberService | None = None,
        inspections: InspectionRepository | None = None,
        inspection_items: InspectionItemRepository | None = None,
        return_items: ReturnItemRepository | None = None,
        rental_items: RentalItemRepository | None = None,
        calendar: CalendarService | None = None,
        dress_status: DressStatusService | None = None,
        settings: SettingService | None = None,
        audit: AuditService | None = None,
    ) -> None:
        super().__init__(session)
        self.batches = batches or ProcessingBatchRepository(session)
        self.items = items or ProcessingItemRepository(session)
        self.settings = settings or SettingService(session)
        self.numbers = numbers or ProcessingNumberService(
            session,
            settings=self.settings,
            batches=self.batches,
        )
        audit_svc = audit or AuditService(session)
        self.audit = audit_svc
        self.calendar = calendar or CalendarService(session, audit=audit_svc)
        self.dress_status = dress_status or DressStatusService(session, audit=audit_svc)
        self.inspections = inspections or InspectionRepository(session)
        self.inspection_items = inspection_items or InspectionItemRepository(session)
        self.return_items = return_items or ReturnItemRepository(session)
        self.rental_items = rental_items or RentalItemRepository(session)

    async def get(self, batch_id: UUID) -> ProcessingBatch:
        record = await self.batches.get_by_id(batch_id)
        if record is None:
            raise NotFoundError("سجل المعالجة غير موجود")
        self.session.expire(record, ["items"])
        await self.session.refresh(record, attribute_names=["items"])
        return record

    async def list(
        self,
        *,
        status: str | None = None,
        dress_id: UUID | None = None,
        sort_by: ProcessingSortField | str = ProcessingSortField.CREATED_AT,
        sort_dir: str = "desc",
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[ProcessingBatch], int]:
        allowed = {field.value for field in ProcessingSortField}
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
                status = ProcessingStatus(status.strip().upper()).value
            except ValueError as exc:
                raise ValidationError(
                    "حالة المعالجة غير صالحة",
                    details={"field": "status"},
                ) from exc
        rows = await self.batches.list_filtered(
            status=status,
            dress_id=dress_id,
            sort_by=sort_key,
            sort_dir=direction,
            offset=offset,
            limit=limit,
        )
        total = await self.batches.count_filtered(status=status, dress_id=dress_id)
        return rows, total

    async def create(
        self,
        *,
        inspection_item_ids: list[UUID],
        notes: str | None = None,
        enable_optional_day: bool = False,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> ProcessingBatch:
        if not inspection_item_ids:
            raise ValidationError("يجب تحديد عنصر فحص واحد على الأقل")
        if len(inspection_item_ids) != len(set(inspection_item_ids)):
            raise ValidationError("لا يجوز تكرار عناصر الفحص في نفس الدفعة")

        resolved: list[tuple[InspectionItem, UUID, UUID]] = []
        for item_id in inspection_item_ids:
            insp_item, return_item_id, rental_item_id = await self._validate_inspection_item(
                item_id
            )
            resolved.append((insp_item, return_item_id, rental_item_id))

        number = await self.numbers.generate_next()
        batch = ProcessingBatch(
            processing_number=number,
            status=ProcessingStatus.PENDING.value,
            optional_extra_day_enabled=bool(enable_optional_day),
            notes=_normalize_notes(notes, max_length=2000, field="notes"),
            created_by=actor_id,
            updated_by=actor_id,
        )
        batch = await self.batches.add(batch)

        created_items: list[ProcessingItem] = []
        for insp_item, return_item_id, rental_item_id in resolved:
            item = ProcessingItem(
                processing_batch_id=batch.id,
                dress_id=insp_item.dress_id,
                inspection_item_id=insp_item.id,
                return_item_id=return_item_id,
                rental_item_id=rental_item_id,
                status=ProcessingStatus.PENDING.value,
                created_by=actor_id,
                updated_by=actor_id,
            )
            item = await self.items.add(item)
            created_items.append(item)

        await self.audit.record_create(
            module="processing",
            entity_type="ProcessingBatch",
            entity_id=batch.id,
            new_values=_snapshot(batch, created_items),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="تم إنشاء دفعة معالجة",
        )
        self.session.expire(batch, ["items"])
        return await self.get(batch.id)

    async def update(
        self,
        batch_id: UUID,
        *,
        notes: str | None = None,
        clear_notes: bool = False,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> ProcessingBatch:
        batch = await self.get(batch_id)
        if batch.status not in {
            ProcessingStatus.PENDING.value,
            ProcessingStatus.IN_PROCESS.value,
        }:
            raise ValidationError(
                "يمكن تعديل دفعات المعالجة المعلقة أو الجارية فقط",
                details={"status": batch.status},
            )
        if not clear_notes and notes is None:
            raise ValidationError("لا توجد حقول للتحديث")

        old_values = _snapshot(batch, await self.items.list_live_for_batch(batch.id))
        fields: dict[str, object] = {
            "updated_by": actor_id,
            "updated_at": utc_now(),
        }
        if clear_notes:
            fields["notes"] = None
        else:
            fields["notes"] = _normalize_notes(notes, max_length=2000, field="notes")
        batch = await self.batches.update_fields(batch, **fields)
        batch = await self.get(batch.id)
        await self.audit.record_update(
            module="processing",
            entity_type="ProcessingBatch",
            entity_id=batch.id,
            old_values=old_values,
            new_values=_snapshot(batch, await self.items.list_live_for_batch(batch.id)),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="تم تحديث دفعة المعالجة",
        )
        return batch

    async def start(
        self,
        batch_id: UUID,
        *,
        enable_optional_day: bool | None = None,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> ProcessingBatch:
        batch = await self.get(batch_id)
        if batch.status != ProcessingStatus.PENDING.value:
            raise ValidationError(
                "يمكن بدء دفعات المعالجة المعلقة فقط",
                details={"status": batch.status},
            )
        live = await self.items.list_live_for_batch(batch.id)
        if not live:
            raise ValidationError("يجب أن تحتوي دفعة المعالجة على عنصر واحد على الأقل")

        for item in live:
            status = await self.dress_status.get_current_status(item.dress_id)
            if status != DressStatus.PROCESSING.value:
                raise ValidationError(
                    "يجب أن يكون الفستان في حالة المعالجة قبل البدء",
                    details={"dress_id": str(item.dress_id), "status": status},
                )

        old_values = _snapshot(batch, live)
        started_at = utc_now()
        mandatory_days = await self.settings.get_int(
            SettingKey.MANDATORY_PROCESSING_DAYS.value
        )
        optional_days = await self.settings.get_int(
            SettingKey.OPTIONAL_PROCESSING_DAYS.value
        )
        optional_enabled = (
            bool(enable_optional_day)
            if enable_optional_day is not None
            else bool(batch.optional_extra_day_enabled)
        )
        mandatory_end = started_at + timedelta(days=mandatory_days)
        final_end = _final_end(
            mandatory_end=mandatory_end,
            optional_enabled=optional_enabled,
            optional_days=optional_days,
        )
        block_end = _calendar_end(started_at, final_end)

        for item in live:
            await self._truncate_related_rental_block(
                item,
                started_at=started_at,
                actor_id=actor_id,
                actor_username=actor_username,
                ip_address=ip_address,
            )
            block = await self.calendar.create_block(
                dress_id=item.dress_id,
                block_type=CalendarBlockType.PROCESSING,
                start_at=started_at,
                end_at=block_end,
                reference_module="processing",
                reference_id=batch.id,
                actor_id=actor_id,
                actor_username=actor_username,
                ip_address=ip_address,
            )
            await self.items.update_fields(
                item,
                calendar_block_id=block.id,
                status=ProcessingStatus.IN_PROCESS.value,
                updated_by=actor_id,
                updated_at=utc_now(),
            )

        batch = await self.batches.update_fields(
            batch,
            status=ProcessingStatus.IN_PROCESS.value,
            started_at=started_at,
            mandatory_processing_end_at=mandatory_end,
            optional_extra_day_enabled=optional_enabled,
            final_processing_end_at=final_end,
            started_by=actor_id,
            updated_by=actor_id,
            updated_at=utc_now(),
        )
        batch = await self.get(batch.id)
        await self.audit.record(
            module="processing",
            entity_type="ProcessingBatch",
            entity_id=batch.id,
            action=AuditAction.CUSTOM,
            old_values=old_values,
            new_values=_snapshot(batch, await self.items.list_live_for_batch(batch.id)),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="تم بدء المعالجة",
        )
        return batch

    async def add_optional_day(
        self,
        batch_id: UUID,
        *,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> ProcessingBatch:
        batch = await self.get(batch_id)
        if batch.status != ProcessingStatus.IN_PROCESS.value:
            raise ValidationError(
                "يمكن إضافة اليوم الاختياري للمعالجة الجارية فقط",
                details={"status": batch.status},
            )
        if batch.optional_extra_day_enabled:
            raise ValidationError("تم تفعيل اليوم الاختياري مسبقاً")
        if batch.mandatory_processing_end_at is None or batch.started_at is None:
            raise ValidationError("بيانات مدة المعالجة غير مكتملة")

        old_values = _snapshot(batch, await self.items.list_live_for_batch(batch.id))
        optional_days = await self.settings.get_int(
            SettingKey.OPTIONAL_PROCESSING_DAYS.value
        )
        mandatory_end = ensure_utc(batch.mandatory_processing_end_at)
        started_at = ensure_utc(batch.started_at)
        final_end = mandatory_end + timedelta(days=optional_days)
        block_end = _calendar_end(started_at, final_end)

        live = await self.items.list_live_for_batch(batch.id)
        for item in live:
            if item.calendar_block_id is None:
                raise ValidationError(
                    "كتلة تقويم المعالجة غير موجودة",
                    details={"item_id": str(item.id)},
                )
            await self.calendar.move_block(
                item.calendar_block_id,
                end_at=block_end,
                actor_id=actor_id,
                actor_username=actor_username,
                ip_address=ip_address,
            )

        batch = await self.batches.update_fields(
            batch,
            optional_extra_day_enabled=True,
            final_processing_end_at=final_end,
            updated_by=actor_id,
            updated_at=utc_now(),
        )
        batch = await self.get(batch.id)
        await self.audit.record(
            module="processing",
            entity_type="ProcessingBatch",
            entity_id=batch.id,
            action=AuditAction.CUSTOM,
            old_values=old_values,
            new_values=_snapshot(batch, await self.items.list_live_for_batch(batch.id)),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="تمت إضافة يوم المعالجة الاختياري",
        )
        return batch

    async def complete(
        self,
        batch_id: UUID,
        *,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> ProcessingBatch:
        batch = await self.get(batch_id)
        if batch.status != ProcessingStatus.IN_PROCESS.value:
            raise ValidationError(
                "يمكن إكمال دفعات المعالجة الجارية فقط",
                details={"status": batch.status},
            )
        if batch.mandatory_processing_end_at is None:
            raise ValidationError("بيانات مدة المعالجة غير مكتملة")
        now = utc_now()
        if now < ensure_utc(batch.mandatory_processing_end_at):
            raise ValidationError(
                "لا يمكن إكمال المعالجة قبل انتهاء المدة الإلزامية",
                details={
                    "mandatory_processing_end_at": ensure_utc(
                        batch.mandatory_processing_end_at
                    ).isoformat(),
                },
            )

        old_values = _snapshot(batch, await self.items.list_live_for_batch(batch.id))
        live = await self.items.list_live_for_batch(batch.id)
        for item in live:
            if item.calendar_block_id is not None:
                await self.calendar.remove_block(
                    item.calendar_block_id,
                    actor_id=actor_id,
                    actor_username=actor_username,
                    ip_address=ip_address,
                )
            await self.dress_status.change_status(
                item.dress_id,
                DressStatus.AVAILABLE,
                reason=f"معالجة {batch.processing_number}",
                actor_id=actor_id,
                actor_username=actor_username,
                ip_address=ip_address,
            )
            await self.items.update_fields(
                item,
                calendar_block_id=None,
                status=ProcessingStatus.COMPLETED.value,
                updated_by=actor_id,
                updated_at=now,
            )

        batch = await self.batches.update_fields(
            batch,
            status=ProcessingStatus.COMPLETED.value,
            completed_at=now,
            completed_by=actor_id,
            updated_by=actor_id,
            updated_at=now,
        )
        batch = await self.get(batch.id)
        await self.audit.record(
            module="processing",
            entity_type="ProcessingBatch",
            entity_id=batch.id,
            action=AuditAction.COMPLETE,
            old_values=old_values,
            new_values=_snapshot(batch, await self.items.list_live_for_batch(batch.id)),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="تم إكمال المعالجة",
        )
        return batch

    async def _validate_inspection_item(
        self,
        inspection_item_id: UUID,
    ) -> tuple[InspectionItem, UUID, UUID]:
        insp_item = await self.inspection_items.get_by_id(inspection_item_id)
        if insp_item is None or insp_item.is_deleted:
            raise NotFoundError("عنصر الفحص غير موجود")

        inspection = await self.inspections.get_by_id(insp_item.inspection_id)
        if inspection is None or inspection.is_deleted:
            raise NotFoundError("سجل الفحص غير موجود")
        if inspection.status != InspectionStatus.COMPLETED.value:
            raise ValidationError(
                "يجب أن يكون الفحص مكتملاً قبل بدء المعالجة",
                details={"inspection_status": inspection.status},
            )

        if insp_item.send_to_ruined or insp_item.condition == DressCondition.MAJOR_DAMAGE.value:
            raise ValidationError(
                "لا يمكن إدخال الفساتين ذات الأضرار الجسيمة إلى المعالجة العادية",
                details={"inspection_item_id": str(insp_item.id)},
            )
        if not insp_item.requires_laundry:
            raise ValidationError(
                "عنصر الفحص لا يتطلب غسيلاً أو معالجة",
                details={"inspection_item_id": str(insp_item.id)},
            )

        dress_status = await self.dress_status.get_current_status(insp_item.dress_id)
        if dress_status != DressStatus.PROCESSING.value:
            raise ValidationError(
                "يجب أن يكون الفستان في حالة المعالجة",
                details={"dress_id": str(insp_item.dress_id), "status": dress_status},
            )

        existing = await self.items.get_active_for_dress(insp_item.dress_id)
        if existing is not None:
            raise ConflictError(
                "يوجد عنصر معالجة نشط لهذا الفستان",
                details={"dress_id": str(insp_item.dress_id)},
            )
        existing_insp = await self.items.get_active_for_inspection_item(insp_item.id)
        if existing_insp is not None:
            raise ConflictError(
                "يوجد عنصر معالجة نشط لعنصر الفحص",
                details={"inspection_item_id": str(insp_item.id)},
            )

        return_item = await self.return_items.get_by_id(insp_item.return_item_id)
        if return_item is None or return_item.is_deleted:
            raise NotFoundError("عنصر الإرجاع غير موجود")
        rental_item = await self.rental_items.get_by_id(return_item.rental_item_id)
        if rental_item is None or rental_item.is_deleted:
            raise NotFoundError("عنصر الإيجار غير موجود")

        return insp_item, return_item.id, rental_item.id

    async def _truncate_related_rental_block(
        self,
        item: ProcessingItem,
        *,
        started_at,
        actor_id: UUID | None,
        actor_username: str | None,
        ip_address: str | None,
    ) -> None:
        rental_item = await self.rental_items.get_by_id(item.rental_item_id)
        if rental_item is None or rental_item.calendar_block_id is None:
            return
        try:
            block = await self.calendar.get_block(rental_item.calendar_block_id)
        except NotFoundError:
            return
        if block.is_deleted:
            return
        block_start = ensure_utc(block.start_at)
        block_end = ensure_utc(block.end_at)
        if block_end <= started_at:
            return
        if block_start >= started_at:
            await self.calendar.remove_block(
                block.id,
                actor_id=actor_id,
                actor_username=actor_username,
                ip_address=ip_address,
            )
            return
        await self.calendar.move_block(
            block.id,
            end_at=started_at,
            actor_id=actor_id,
            actor_username=actor_username,
            ip_address=ip_address,
        )
