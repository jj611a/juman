"""SettlementService — post-return financial obligations."""

from __future__ import annotations

import math
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.inspection.constants import DressCondition, InspectionStatus
from app.modules.inspection.repositories.inspection import (
    InspectionItemRepository,
    InspectionRepository,
)
from app.modules.rentals.constants import RentalStatus
from app.modules.rentals.repositories.rental import RentalItemRepository, RentalRepository
from app.modules.returns.constants import ReturnStatus
from app.modules.returns.repositories.return_record import (
    ReturnItemRepository,
    ReturnRepository,
)
from app.modules.settings.services.setting import SettingService
from app.modules.settlements.constants import (
    ChargeType,
    PaymentMethod,
    SettlementSortField,
    SettlementStatus,
)
from app.modules.settlements.models.adjustment import RentalSettlementAdjustment
from app.modules.settlements.models.charge import RentalSettlementCharge
from app.modules.settlements.models.payment import RentalSettlementPayment
from app.modules.settlements.models.settlement import RentalSettlement
from app.modules.settlements.repositories.settlement import (
    RentalSettlementAdjustmentRepository,
    RentalSettlementChargeRepository,
    RentalSettlementPaymentRepository,
    RentalSettlementRepository,
)
from app.modules.settlements.services.settlement_number import SettlementNumberService
from app.services.base import BaseService
from app.utils.datetime import ensure_utc, utc_now


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


def _snapshot(settlement: RentalSettlement) -> dict[str, Any]:
    return {
        "settlement_number": settlement.settlement_number,
        "rental_id": str(settlement.rental_id),
        "return_id": str(settlement.return_id),
        "status": settlement.status,
        "rental_charge_amount": settlement.rental_charge_amount,
        "initial_payment_credit": settlement.initial_payment_credit,
        "late_penalty_amount": settlement.late_penalty_amount,
        "minor_damage_penalty_amount": settlement.minor_damage_penalty_amount,
        "manual_adjustment_amount": settlement.manual_adjustment_amount,
        "gross_total": settlement.gross_total,
        "total_due": settlement.total_due,
        "total_paid": settlement.total_paid,
        "remaining_balance": settlement.remaining_balance,
        "settled_at": (
            ensure_utc(settlement.settled_at).isoformat() if settlement.settled_at else None
        ),
        "settled_by": str(settlement.settled_by) if settlement.settled_by else None,
        "notes": settlement.notes,
    }


class SettlementService(BaseService):
    """Create settlements and record payments / adjustments."""

    @staticmethod
    def late_days(returned_at: datetime, expected_return_at: datetime) -> int:
        """Whole late days via ceil(seconds/86400); on-time or early → 0."""
        returned = ensure_utc(returned_at)
        expected = ensure_utc(expected_return_at)
        late_seconds = max(0.0, (returned - expected).total_seconds())
        if late_seconds == 0:
            return 0
        return int(math.ceil(late_seconds / 86400))

    def __init__(
        self,
        session: AsyncSession,
        *,
        settlements: RentalSettlementRepository | None = None,
        charges: RentalSettlementChargeRepository | None = None,
        payments: RentalSettlementPaymentRepository | None = None,
        adjustments: RentalSettlementAdjustmentRepository | None = None,
        numbers: SettlementNumberService | None = None,
        rentals: RentalRepository | None = None,
        rental_items: RentalItemRepository | None = None,
        returns: ReturnRepository | None = None,
        return_items: ReturnItemRepository | None = None,
        inspections: InspectionRepository | None = None,
        inspection_items: InspectionItemRepository | None = None,
        settings: SettingService | None = None,
        audit: AuditService | None = None,
    ) -> None:
        super().__init__(session)
        self.settlements = settlements or RentalSettlementRepository(session)
        self.charges = charges or RentalSettlementChargeRepository(session)
        self.payments = payments or RentalSettlementPaymentRepository(session)
        self.adjustments = adjustments or RentalSettlementAdjustmentRepository(session)
        self.settings = settings or SettingService(session)
        self.numbers = numbers or SettlementNumberService(
            session,
            settings=self.settings,
            settlements=self.settlements,
        )
        self.rentals = rentals or RentalRepository(session)
        self.rental_items = rental_items or RentalItemRepository(session)
        self.returns = returns or ReturnRepository(session)
        self.return_items = return_items or ReturnItemRepository(session)
        self.inspections = inspections or InspectionRepository(session)
        self.inspection_items = inspection_items or InspectionItemRepository(session)
        self.audit = audit or AuditService(session)

    async def get(self, settlement_id: UUID) -> RentalSettlement:
        record = await self.settlements.get_by_id(settlement_id)
        if record is None:
            raise NotFoundError("سجل التسوية غير موجود")
        self.session.expire(record, ["charges", "payments", "adjustments"])
        await self.session.refresh(
            record, attribute_names=["charges", "payments", "adjustments"]
        )
        return record

    async def get_by_rental(self, rental_id: UUID) -> RentalSettlement:
        record = await self.settlements.get_live_by_rental_id(rental_id)
        if record is None:
            raise NotFoundError("لا توجد تسوية نشطة لهذا الإيجار")
        self.session.expire(record, ["charges", "payments", "adjustments"])
        await self.session.refresh(
            record, attribute_names=["charges", "payments", "adjustments"]
        )
        return record

    async def list(
        self,
        *,
        status: str | None = None,
        rental_id: UUID | None = None,
        sort_by: SettlementSortField | str = SettlementSortField.CREATED_AT,
        sort_dir: str = "desc",
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[RentalSettlement], int]:
        allowed = {field.value for field in SettlementSortField}
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
                status = SettlementStatus(status.strip().upper()).value
            except ValueError as exc:
                raise ValidationError(
                    "حالة التسوية غير صالحة",
                    details={"field": "status"},
                ) from exc
        rows = await self.settlements.list_filtered(
            status=status,
            rental_id=rental_id,
            sort_by=sort_key,
            sort_dir=direction,
            offset=offset,
            limit=limit,
        )
        total = await self.settlements.count_filtered(status=status, rental_id=rental_id)
        return rows, total

    async def create(
        self,
        *,
        rental_id: UUID,
        notes: str | None = None,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> RentalSettlement:
        rental = await self.rentals.get_by_id(rental_id)
        if rental is None or rental.is_deleted:
            raise NotFoundError("سجل الإيجار غير موجود")
        if rental.status != RentalStatus.RETURN_PENDING.value:
            raise ValidationError(
                "يمكن إنشاء التسوية فقط للإيجارات بانتظار الإرجاع",
                details={"status": rental.status},
            )

        ret = await self.returns.get_live_by_rental_id(rental.id)
        if ret is None or ret.is_deleted:
            raise NotFoundError("سجل الإرجاع غير موجود")
        if ret.status != ReturnStatus.INSPECTION_COMPLETED.value:
            raise ValidationError(
                "يجب اكتمال الفحص قبل إنشاء التسوية",
                details={"return_status": ret.status},
            )

        existing = await self.settlements.get_live_by_rental_id(rental.id)
        if existing is not None:
            raise ConflictError(
                "توجد تسوية نشطة لهذا الإيجار مسبقاً",
                details={"settlement_id": str(existing.id)},
            )

        days_late = self.late_days(ret.returned_at, rental.expected_return_at)

        inspection = await self.inspections.get_live_by_return_id(ret.id)
        if inspection is None or inspection.is_deleted:
            raise NotFoundError("سجل الفحص غير موجود")
        if inspection.status != InspectionStatus.COMPLETED.value:
            raise ValidationError(
                "يجب أن يكون الفحص مكتملاً قبل إنشاء التسوية",
                details={"inspection_status": inspection.status},
            )

        live_items = await self.rental_items.list_live_for_rental(rental.id)
        if not live_items:
            raise ValidationError("يجب أن يحتوي الإيجار على فستان واحد على الأقل")

        insp_items = await self.inspection_items.list_live_for_inspection(inspection.id)
        return_items = await self.return_items.list_live_for_return(ret.id)
        return_item_to_rental: dict[UUID, UUID] = {
            ri.id: ri.rental_item_id for ri in return_items
        }

        rental_charge = int(rental.estimated_total)
        late_penalty = 0
        damage_penalty = 0
        charge_rows: list[RentalSettlementCharge] = []

        for item in live_items:
            line_rental = int(item.agreed_daily_rental_price) * int(item.expected_rental_days)
            charge_rows.append(
                RentalSettlementCharge(
                    charge_type=ChargeType.RENTAL.value,
                    amount=line_rental,
                    rental_item_id=item.id,
                    inspection_item_id=None,
                    description="أجرة الإيجار",
                    created_by=actor_id,
                    updated_by=actor_id,
                )
            )
            if days_late > 0:
                line_late = int(item.agreed_daily_rental_price) * days_late
                late_penalty += line_late
                charge_rows.append(
                    RentalSettlementCharge(
                        charge_type=ChargeType.LATE.value,
                        amount=line_late,
                        rental_item_id=item.id,
                        inspection_item_id=None,
                        description="غرامة التأخير",
                        created_by=actor_id,
                        updated_by=actor_id,
                    )
                )

        for insp_item in insp_items:
            if insp_item.condition != DressCondition.MINOR_DAMAGE.value:
                continue
            if insp_item.send_to_ruined:
                continue
            penalty = insp_item.repair_penalty_amount
            if penalty is None or int(penalty) < 1:
                continue
            amount = int(penalty)
            damage_penalty += amount
            rental_item_id = return_item_to_rental.get(insp_item.return_item_id)
            charge_rows.append(
                RentalSettlementCharge(
                    charge_type=ChargeType.DAMAGE.value,
                    amount=amount,
                    rental_item_id=rental_item_id,
                    inspection_item_id=insp_item.id,
                    description="غرامة ضرر طفيف",
                    created_by=actor_id,
                    updated_by=actor_id,
                )
            )

        initial_credit = int(rental.initial_payment_value)
        if initial_credit < 0:
            raise ValidationError(
                "قيمة الدفعة الأولية غير صالحة",
                details={"field": "initial_payment_value"},
            )
        charge_rows.append(
            RentalSettlementCharge(
                charge_type=ChargeType.INITIAL_CREDIT.value,
                amount=initial_credit,
                rental_item_id=None,
                inspection_item_id=None,
                description="دفعة أولية",
                created_by=actor_id,
                updated_by=actor_id,
            )
        )

        number = await self.numbers.generate_next()
        gross = rental_charge + late_penalty + damage_penalty
        total_due = max(0, gross - initial_credit)
        remaining = max(0, gross - initial_credit)
        status = (
            SettlementStatus.PAID.value
            if remaining == 0
            else SettlementStatus.OPEN.value
        )
        now = utc_now()

        settlement = RentalSettlement(
            settlement_number=number,
            rental_id=rental.id,
            return_id=ret.id,
            status=status,
            rental_charge_amount=rental_charge,
            initial_payment_credit=initial_credit,
            late_penalty_amount=late_penalty,
            minor_damage_penalty_amount=damage_penalty,
            manual_adjustment_amount=0,
            gross_total=gross,
            total_due=total_due,
            total_paid=0,
            remaining_balance=remaining,
            settled_at=now if status == SettlementStatus.PAID.value else None,
            settled_by=actor_id if status == SettlementStatus.PAID.value else None,
            notes=_normalize_notes(notes, max_length=2000, field="notes"),
            created_by=actor_id,
            updated_by=actor_id,
        )
        settlement = await self.settlements.add(settlement)

        for charge in charge_rows:
            charge.settlement_id = settlement.id
            await self.charges.add(charge)

        settlement = await self._recompute_totals(settlement)
        settlement = await self._apply_status(settlement, actor_id=actor_id)

        await self.audit.record_create(
            module="settlement",
            entity_type="RentalSettlement",
            entity_id=settlement.id,
            new_values=_snapshot(settlement),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="تم إنشاء تسوية الإيجار",
        )
        return await self.get(settlement.id)

    async def add_payment(
        self,
        settlement_id: UUID,
        *,
        amount: int,
        method: str | PaymentMethod,
        reference_number: str | None = None,
        notes: str | None = None,
        received_at: datetime | None = None,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> RentalSettlement:
        settlement = await self.settlements.get_for_update(settlement_id)
        if settlement is None:
            raise NotFoundError("سجل التسوية غير موجود")

        settlement = await self._recompute_totals(settlement)

        if settlement.status in {
            SettlementStatus.PAID.value,
            SettlementStatus.VOIDED.value,
        }:
            raise ValidationError(
                "لا يمكن تسجيل دفعة على تسوية مدفوعة أو ملغاة",
                details={"status": settlement.status},
            )

        if amount <= 0:
            raise ValidationError(
                "مبلغ الدفعة يجب أن يكون أكبر من صفر",
                details={"field": "amount"},
            )
        if amount > settlement.remaining_balance:
            raise ValidationError(
                "مبلغ الدفعة يتجاوز الرصيد المتبقي",
                details={
                    "field": "amount",
                    "remaining_balance": settlement.remaining_balance,
                },
            )

        try:
            payment_method = PaymentMethod(
                str(method).strip().upper() if isinstance(method, str) else method.value
            ).value
        except ValueError as exc:
            raise ValidationError(
                "طريقة الدفع غير صالحة",
                details={"field": "payment_method"},
            ) from exc

        ref = None
        if reference_number is not None:
            ref = reference_number.strip() or None
            if ref is not None and len(ref) > 100:
                raise ValidationError(
                    "رقم المرجع أطول من الحد المسموح",
                    details={"field": "reference_number", "max_length": 100},
                )

        old_values = _snapshot(settlement)
        payment = RentalSettlementPayment(
            settlement_id=settlement.id,
            amount=int(amount),
            payment_method=payment_method,
            received_at=ensure_utc(received_at) if received_at is not None else utc_now(),
            received_by=actor_id,
            reference_number=ref,
            notes=_normalize_notes(notes, max_length=1000, field="notes"),
            created_by=actor_id,
            updated_by=actor_id,
        )
        payment = await self.payments.add(payment)

        settlement = await self._recompute_totals(settlement)
        settlement = await self._apply_status(settlement, actor_id=actor_id)

        await self.audit.record_create(
            module="settlement",
            entity_type="RentalSettlementPayment",
            entity_id=payment.id,
            new_values={
                "settlement_id": str(settlement.id),
                "amount": payment.amount,
                "payment_method": payment.payment_method,
            },
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="تم تسجيل دفعة تسوية",
        )

        action = (
            AuditAction.COMPLETE
            if settlement.status == SettlementStatus.PAID.value
            else AuditAction.UPDATE
        )
        await self.audit.record(
            module="settlement",
            entity_type="RentalSettlement",
            entity_id=settlement.id,
            action=action,
            old_values=old_values,
            new_values=_snapshot(settlement),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message=(
                "تم سداد التسوية بالكامل"
                if action == AuditAction.COMPLETE
                else "تم تحديث التسوية بعد تسجيل دفعة"
            ),
        )
        return await self.get(settlement.id)

    async def add_adjustment(
        self,
        settlement_id: UUID,
        *,
        amount: int,
        reason: str,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> RentalSettlement:
        settlement = await self.settlements.get_for_update(settlement_id)
        if settlement is None:
            raise NotFoundError("سجل التسوية غير موجود")

        settlement = await self._recompute_totals(settlement)

        if settlement.status in {
            SettlementStatus.PAID.value,
            SettlementStatus.VOIDED.value,
        }:
            raise ValidationError(
                "لا يمكن تعديل تسوية مدفوعة أو ملغاة",
                details={"status": settlement.status},
            )

        signed = int(amount)
        if signed == 0:
            raise ValidationError(
                "مبلغ التعديل يجب ألا يكون صفراً",
                details={"field": "amount"},
            )

        reason_text = reason.strip() if reason else ""
        if len(reason_text) < 3:
            raise ValidationError(
                "سبب التعديل يجب أن يكون ثلاثة أحرف على الأقل",
                details={"field": "reason", "min_length": 3},
            )
        if len(reason_text) > 500:
            raise ValidationError(
                "سبب التعديل أطول من الحد المسموح",
                details={"field": "reason", "max_length": 500},
            )

        projected_adj = int(settlement.manual_adjustment_amount) + signed
        projected_gross = (
            int(settlement.rental_charge_amount)
            + int(settlement.late_penalty_amount)
            + int(settlement.minor_damage_penalty_amount)
            + projected_adj
        )
        projected_remaining = (
            projected_gross
            - int(settlement.initial_payment_credit)
            - int(settlement.total_paid)
        )
        if projected_remaining < 0:
            raise ValidationError(
                "التعديل يجعل الرصيد المتبقي سالباً ولا يُسمح بالاسترداد",
                details={"projected_remaining": projected_remaining},
            )

        old_values = _snapshot(settlement)
        adjustment = RentalSettlementAdjustment(
            settlement_id=settlement.id,
            amount=signed,
            reason=reason_text,
            created_by=actor_id,
            updated_by=actor_id,
        )
        await self.adjustments.add(adjustment)

        settlement = await self._recompute_totals(settlement)
        settlement = await self._apply_status(settlement, actor_id=actor_id)

        await self.audit.record(
            module="settlement",
            entity_type="RentalSettlement",
            entity_id=settlement.id,
            action=AuditAction.CUSTOM,
            old_values=old_values,
            new_values=_snapshot(settlement),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="تم تسجيل تعديل على التسوية",
            metadata={"adjustment_amount": signed, "reason": reason_text},
        )
        return await self.get(settlement.id)

    async def _recompute_totals(self, settlement: RentalSettlement) -> RentalSettlement:
        total_paid = await self.payments.sum_payments(settlement.id)
        manual_adjustment = await self.adjustments.sum_adjustments(settlement.id)
        gross = (
            int(settlement.rental_charge_amount)
            + int(settlement.late_penalty_amount)
            + int(settlement.minor_damage_penalty_amount)
            + manual_adjustment
        )
        credit = int(settlement.initial_payment_credit)
        total_due = max(0, gross - credit)
        remaining = max(0, gross - credit - total_paid)
        return await self.settlements.update_fields(
            settlement,
            manual_adjustment_amount=manual_adjustment,
            gross_total=gross,
            total_due=total_due,
            total_paid=total_paid,
            remaining_balance=remaining,
            updated_at=utc_now(),
        )

    async def _apply_status(
        self,
        settlement: RentalSettlement,
        *,
        actor_id: UUID | None,
    ) -> RentalSettlement:
        remaining = int(settlement.remaining_balance)
        total_paid = int(settlement.total_paid)
        if remaining == 0:
            fields: dict[str, object] = {
                "status": SettlementStatus.PAID.value,
                "updated_by": actor_id,
                "updated_at": utc_now(),
            }
            if settlement.settled_at is None:
                fields["settled_at"] = utc_now()
                fields["settled_by"] = actor_id
            return await self.settlements.update_fields(settlement, **fields)
        if total_paid == 0:
            return await self.settlements.update_fields(
                settlement,
                status=SettlementStatus.OPEN.value,
                settled_at=None,
                settled_by=None,
                updated_by=actor_id,
                updated_at=utc_now(),
            )
        return await self.settlements.update_fields(
            settlement,
            status=SettlementStatus.PARTIALLY_PAID.value,
            settled_at=None,
            settled_by=None,
            updated_by=actor_id,
            updated_at=utc_now(),
        )
