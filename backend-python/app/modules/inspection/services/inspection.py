"""InspectionService — post-return condition assessment."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.inspection.constants import DressCondition, InspectionSortField, InspectionStatus
from app.modules.inspection.models.inspection import Inspection
from app.modules.inspection.models.inspection_item import InspectionItem
from app.modules.inspection.repositories.inspection import (
    InspectionItemRepository,
    InspectionRepository,
)
from app.modules.inspection.services.inspection_number import InspectionNumberService
from app.modules.inventory.constants import DressStatus
from app.modules.inventory.services.dress_status import DressStatusService
from app.modules.returns.constants import ReturnStatus
from app.modules.returns.services.return_service import ReturnService
from app.modules.settings.services.setting import SettingService
from app.services.base import BaseService
from app.utils.datetime import ensure_utc, utc_now


def _snapshot(record: Inspection, items: list[InspectionItem] | None = None) -> dict[str, Any]:
    live = items if items is not None else [i for i in (record.items or []) if not i.is_deleted]
    return {
        "inspection_number": record.inspection_number,
        "return_id": str(record.return_id),
        "inspected_at": (
            ensure_utc(record.inspected_at).isoformat() if record.inspected_at else None
        ),
        "inspected_by": str(record.inspected_by) if record.inspected_by else None,
        "status": record.status,
        "notes": record.notes,
        "items": [
            {
                "id": str(item.id),
                "return_item_id": str(item.return_item_id),
                "dress_id": str(item.dress_id),
                "condition": item.condition,
                "repair_penalty_amount": item.repair_penalty_amount,
                "requires_laundry": item.requires_laundry,
                "send_to_ruined": item.send_to_ruined,
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


def _validate_item_fields(
    *,
    condition: str | DressCondition,
    repair_penalty_amount: int | None,
    requires_laundry: bool,
    send_to_ruined: bool,
) -> tuple[str, int | None, bool, bool]:
    try:
        cond = (
            condition
            if isinstance(condition, DressCondition)
            else DressCondition(str(condition).strip().upper())
        )
    except ValueError as exc:
        raise ValidationError(
            "حالة الفستان غير صالحة",
            details={"field": "condition"},
        ) from exc

    if cond == DressCondition.GOOD:
        if repair_penalty_amount is not None:
            raise ValidationError(
                "لا يجوز تسجيل غرامة إصلاح لحالة جيدة",
                details={"field": "repair_penalty_amount"},
            )
        if send_to_ruined:
            raise ValidationError(
                "لا يجوز تعليم الفستان كتالف لحالة جيدة",
                details={"field": "send_to_ruined"},
            )
        return cond.value, None, bool(requires_laundry), False

    if cond == DressCondition.MINOR_DAMAGE:
        if repair_penalty_amount is None or repair_penalty_amount < 1:
            raise ValidationError(
                "غرامة الإصلاح مطلوبة للأضرار البسيطة",
                details={"field": "repair_penalty_amount"},
            )
        if send_to_ruined:
            raise ValidationError(
                "لا يجوز تعليم الفستان كتالف للأضرار البسيطة",
                details={"field": "send_to_ruined"},
            )
        if not requires_laundry:
            raise ValidationError(
                "الأضرار البسيطة تتطلب إرسال الفستان للغسيل",
                details={"field": "requires_laundry"},
            )
        return cond.value, int(repair_penalty_amount), True, False

    # MAJOR_DAMAGE
    if repair_penalty_amount is not None:
        raise ValidationError(
            "لا يجوز تسجيل غرامة إصلاح للأضرار الجسيمة",
            details={"field": "repair_penalty_amount"},
        )
    if requires_laundry:
        raise ValidationError(
            "الأضرار الجسيمة لا ترسل للغسيل",
            details={"field": "requires_laundry"},
        )
    if not send_to_ruined:
        raise ValidationError(
            "يجب تعليم الفستان كتالف بانتظار البيع للأضرار الجسيمة",
            details={"field": "send_to_ruined"},
        )
    return cond.value, None, False, True


def _target_status(
    condition: str,
    *,
    requires_laundry: bool,
) -> DressStatus:
    if condition == DressCondition.MAJOR_DAMAGE.value:
        return DressStatus.RUINED_PENDING_SALE
    if condition == DressCondition.MINOR_DAMAGE.value:
        return DressStatus.PROCESSING
    # GOOD
    return DressStatus.PROCESSING if requires_laundry else DressStatus.AVAILABLE


class InspectionService(BaseService):
    """Create PENDING inspections and complete them with conditions."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        inspections: InspectionRepository | None = None,
        items: InspectionItemRepository | None = None,
        numbers: InspectionNumberService | None = None,
        returns: ReturnService | None = None,
        dress_status: DressStatusService | None = None,
        settings: SettingService | None = None,
        audit: AuditService | None = None,
    ) -> None:
        super().__init__(session)
        self.inspections = inspections or InspectionRepository(session)
        self.items = items or InspectionItemRepository(session)
        self.settings = settings or SettingService(session)
        self.numbers = numbers or InspectionNumberService(
            session,
            settings=self.settings,
            inspections=self.inspections,
        )
        audit_svc = audit or AuditService(session)
        self.dress_status = dress_status or DressStatusService(session, audit=audit_svc)
        self.returns = returns or ReturnService(
            session,
            settings=self.settings,
            dress_status=self.dress_status,
            audit=audit_svc,
        )
        self.audit = audit_svc

    async def get(self, inspection_id: UUID) -> Inspection:
        record = await self.inspections.get_by_id(inspection_id)
        if record is None:
            raise NotFoundError("سجل الفحص غير موجود")
        self.session.expire(record, ["items"])
        await self.session.refresh(record, attribute_names=["items"])
        return record

    async def list(
        self,
        *,
        status: str | None = None,
        return_id: UUID | None = None,
        sort_by: InspectionSortField | str = InspectionSortField.CREATED_AT,
        sort_dir: str = "desc",
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Inspection], int]:
        allowed = {field.value for field in InspectionSortField}
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
                status = InspectionStatus(status.strip().upper()).value
            except ValueError as exc:
                raise ValidationError(
                    "حالة الفحص غير صالحة",
                    details={"field": "status"},
                ) from exc
        rows = await self.inspections.list_filtered(
            status=status,
            return_id=return_id,
            sort_by=sort_key,
            sort_dir=direction,
            offset=offset,
            limit=limit,
        )
        total = await self.inspections.count_filtered(status=status, return_id=return_id)
        return rows, total

    async def create(
        self,
        *,
        return_id: UUID,
        notes: str | None = None,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Inspection:
        """Scaffold a PENDING inspection for a PENDING_INSPECTION return."""
        ret = await self.returns.get(return_id)
        existing = await self.inspections.get_live_by_return_id(ret.id)
        if existing is not None:
            raise ConflictError(
                "تم إنشاء فحص لهذا الإرجاع مسبقاً",
                details={"return_id": str(ret.id), "inspection_id": str(existing.id)},
            )
        if ret.status != ReturnStatus.PENDING_INSPECTION.value:
            raise ValidationError(
                "يمكن فحص المرتجعات قيد انتظار الفحص فقط",
                details={"status": ret.status},
            )
        live_return_items = [i for i in (ret.items or []) if not i.is_deleted]
        if not live_return_items:
            raise ValidationError("يجب أن يحتوي الإرجاع على فستان واحد على الأقل")

        number = await self.numbers.generate_next()
        record = Inspection(
            inspection_number=number,
            return_id=ret.id,
            status=InspectionStatus.PENDING.value,
            notes=_normalize_notes(notes, max_length=2000, field="notes"),
            created_by=actor_id,
            updated_by=actor_id,
        )
        record = await self.inspections.add(record)

        created_items: list[InspectionItem] = []
        for ritem in live_return_items:
            item = InspectionItem(
                inspection_id=record.id,
                return_item_id=ritem.id,
                dress_id=ritem.dress_id,
                requires_laundry=False,
                send_to_ruined=False,
                created_by=actor_id,
                updated_by=actor_id,
            )
            item = await self.items.add(item)
            created_items.append(item)

        await self.audit.record_create(
            module="inspection",
            entity_type="Inspection",
            entity_id=record.id,
            new_values=_snapshot(record, created_items),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="تم إنشاء فحص",
        )
        self.session.expire(record, ["items"])
        return await self.get(record.id)

    async def update(
        self,
        inspection_id: UUID,
        *,
        notes: str | None = None,
        clear_notes: bool = False,
        items: list[dict[str, Any]] | None = None,
        complete: bool = False,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Inspection:
        """Update PENDING inspection items/notes; optionally complete."""
        record = await self.get(inspection_id)
        if record.status != InspectionStatus.PENDING.value:
            raise ValidationError(
                "يمكن تعديل الفحوصات المعلقة فقط",
                details={"status": record.status},
            )
        old_values = _snapshot(record, await self.items.list_live_for_inspection(record.id))

        if clear_notes:
            record = await self.inspections.update_fields(
                record,
                notes=None,
                updated_by=actor_id,
                updated_at=utc_now(),
            )
        elif notes is not None:
            record = await self.inspections.update_fields(
                record,
                notes=_normalize_notes(notes, max_length=2000, field="notes"),
                updated_by=actor_id,
                updated_at=utc_now(),
            )

        if items is not None:
            by_id = {
                i.id: i
                for i in await self.items.list_live_for_inspection(record.id)
            }
            for raw in items:
                item_id = raw.get("id")
                if item_id is None or item_id not in by_id:
                    raise ValidationError(
                        "عنصر الفحص غير موجود",
                        details={"field": "items.id"},
                    )
                item = by_id[item_id]
                if "condition" not in raw or raw["condition"] is None:
                    raise ValidationError(
                        "حالة الفستان مطلوبة",
                        details={"field": "condition"},
                    )
                cond, penalty, laundry, ruined = _validate_item_fields(
                    condition=raw["condition"],
                    repair_penalty_amount=raw.get("repair_penalty_amount"),
                    requires_laundry=bool(raw.get("requires_laundry", False)),
                    send_to_ruined=bool(raw.get("send_to_ruined", False)),
                )
                fields: dict[str, object] = {
                    "condition": cond,
                    "repair_penalty_amount": penalty,
                    "requires_laundry": laundry,
                    "send_to_ruined": ruined,
                    "updated_by": actor_id,
                    "updated_at": utc_now(),
                }
                if "repair_notes" in raw:
                    fields["repair_notes"] = _normalize_notes(
                        raw.get("repair_notes"),
                        max_length=2000,
                        field="repair_notes",
                    )
                if "notes" in raw:
                    fields["notes"] = _normalize_notes(
                        raw.get("notes"),
                        max_length=1000,
                        field="items.notes",
                    )
                await self.items.update_fields(item, **fields)

        if not complete:
            if items is None and notes is None and not clear_notes:
                raise ValidationError("لا توجد حقول للتحديث")
            record = await self.get(record.id)
            await self.audit.record_update(
                module="inspection",
                entity_type="Inspection",
                entity_id=record.id,
                old_values=old_values,
                new_values=_snapshot(record, await self.items.list_live_for_inspection(record.id)),
                user_id=actor_id,
                username=actor_username,
                ip_address=ip_address,
                message="تم تحديث الفحص",
            )
            return record

        return await self._complete(
            record.id,
            old_values=old_values,
            actor_id=actor_id,
            actor_username=actor_username,
            ip_address=ip_address,
        )

    async def _complete(
        self,
        inspection_id: UUID,
        *,
        old_values: dict[str, Any],
        actor_id: UUID | None,
        actor_username: str | None,
        ip_address: str | None,
    ) -> Inspection:
        record = await self.get(inspection_id)
        live = await self.items.list_live_for_inspection(record.id)
        if not live:
            raise ValidationError("يجب أن يحتوي الفحص على عنصر واحد على الأقل")
        for item in live:
            if not item.condition:
                raise ValidationError(
                    "يجب تحديد حالة كل فستان قبل إكمال الفحص",
                    details={"item_id": str(item.id)},
                )
            # Re-validate stored fields for safety
            _validate_item_fields(
                condition=item.condition,
                repair_penalty_amount=item.repair_penalty_amount,
                requires_laundry=item.requires_laundry,
                send_to_ruined=item.send_to_ruined,
            )

        for item in live:
            target = _target_status(item.condition or "", requires_laundry=item.requires_laundry)
            reason = f"فحص {record.inspection_number}: {item.condition}"
            await self.dress_status.change_status(
                item.dress_id,
                target,
                reason=reason,
                actor_id=actor_id,
                actor_username=actor_username,
                ip_address=ip_address,
            )

        await self.returns.mark_inspection_completed(
            record.return_id,
            actor_id=actor_id,
            actor_username=actor_username,
            ip_address=ip_address,
        )

        now = utc_now()
        record = await self.inspections.update_fields(
            record,
            status=InspectionStatus.COMPLETED.value,
            inspected_at=now,
            inspected_by=actor_id,
            updated_by=actor_id,
            updated_at=now,
        )
        record = await self.get(record.id)
        new_values = _snapshot(record, await self.items.list_live_for_inspection(record.id))
        await self.audit.record(
            module="inspection",
            entity_type="Inspection",
            entity_id=record.id,
            action=AuditAction.COMPLETE,
            old_values=old_values,
            new_values=new_values,
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="تم إكمال الفحص",
        )
        return record
