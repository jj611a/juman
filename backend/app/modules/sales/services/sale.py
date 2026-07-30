"""SaleService - atomic dress sales."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import BusinessError, ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.calendar.constants import CalendarBlockType
from app.modules.calendar.services.calendar import CalendarService
from app.modules.customers.repositories.customer import CustomerRepository
from app.modules.inspection.constants import DressCondition, InspectionStatus
from app.modules.inspection.repositories.inspection import (
    InspectionItemRepository,
    InspectionRepository,
)
from app.modules.inventory.constants import DressStatus
from app.modules.inventory.repositories.dress import DressRepository
from app.modules.inventory.services.dress_status import DressStatusService
from app.modules.rentals.repositories.rental import RentalRepository
from app.modules.returns.repositories.return_record import ReturnRepository
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.modules.sales.constants import (
    SaleOrigin,
    SalePaymentMethod,
    SaleSortField,
    SaleStatus,
)
from app.modules.sales.models.item import SaleItem
from app.modules.sales.models.payment import SalePayment
from app.modules.sales.models.sale import Sale
from app.modules.sales.repositories.sale import (
    SaleItemRepository,
    SalePaymentRepository,
    SaleRepository,
)
from app.modules.sales.schemas.sale import SaleItemCreateRequest, SalePaymentCreateRequest
from app.modules.sales.services.sale_number import SaleNumberService
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


def _snapshot(sale: Sale) -> dict[str, Any]:
    return {
        "sale_number": sale.sale_number,
        "origin": sale.origin,
        "status": sale.status,
        "customer_id": str(sale.customer_id) if sale.customer_id else None,
        "rental_id": str(sale.rental_id) if sale.rental_id else None,
        "return_id": str(sale.return_id) if sale.return_id else None,
        "inspection_id": str(sale.inspection_id) if sale.inspection_id else None,
        "total_amount": sale.total_amount,
        "sold_at": ensure_utc(sale.sold_at).isoformat(),
        "sold_by": str(sale.sold_by) if sale.sold_by else None,
        "notes": sale.notes,
    }

class SaleService(BaseService):
    """Post atomic completed sales with full payment."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        sales: SaleRepository | None = None,
        items: SaleItemRepository | None = None,
        payments: SalePaymentRepository | None = None,
        numbers: SaleNumberService | None = None,
        dresses: DressRepository | None = None,
        dress_status: DressStatusService | None = None,
        calendar: CalendarService | None = None,
        customers: CustomerRepository | None = None,
        rentals: RentalRepository | None = None,
        returns: ReturnRepository | None = None,
        inspections: InspectionRepository | None = None,
        inspection_items: InspectionItemRepository | None = None,
        settings: SettingService | None = None,
        audit: AuditService | None = None,
    ) -> None:
        super().__init__(session)
        audit_svc = audit or AuditService(session)
        self.sales = sales or SaleRepository(session)
        self.items = items or SaleItemRepository(session)
        self.payments = payments or SalePaymentRepository(session)
        self.settings = settings or SettingService(session)
        self.numbers = numbers or SaleNumberService(
            session,
            settings=self.settings,
            sales=self.sales,
        )
        self.dresses = dresses or DressRepository(session)
        self.dress_status = dress_status or DressStatusService(session, audit=audit_svc)
        self.calendar = calendar or CalendarService(session, audit=audit_svc)
        self.customers = customers or CustomerRepository(session)
        self.rentals = rentals or RentalRepository(session)
        self.returns = returns or ReturnRepository(session)
        self.inspections = inspections or InspectionRepository(session)
        self.inspection_items = inspection_items or InspectionItemRepository(session)
        self.audit = audit_svc

    async def get(self, sale_id: UUID) -> Sale:
        record = await self.sales.get_by_id(sale_id)
        if record is None:
            raise NotFoundError("سجل البيع غير موجود")
        self.session.expire(record, ["items", "payments"])
        await self.session.refresh(record, attribute_names=["items", "payments"])
        return record

    async def list(
        self,
        *,
        status: str | None = None,
        origin: str | None = None,
        customer_id: UUID | None = None,
        sort_by: SaleSortField | str = SaleSortField.CREATED_AT,
        sort_dir: str = "desc",
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Sale], int]:
        allowed = {field.value for field in SaleSortField}
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
                status = SaleStatus(status.strip().upper()).value
            except ValueError as exc:
                raise ValidationError(
                    "حالة البيع غير صالحة",
                    details={"field": "status"},
                ) from exc
        if origin is not None:
            try:
                origin = SaleOrigin(origin.strip().upper()).value
            except ValueError as exc:
                raise ValidationError(
                    "مصدر البيع غير صالح",
                    details={"field": "origin"},
                ) from exc
        rows = await self.sales.list_filtered(
            status=status,
            origin=origin,
            customer_id=customer_id,
            sort_by=sort_key,
            sort_dir=direction,
            offset=offset,
            limit=limit,
        )
        total = await self.sales.count_filtered(
            status=status,
            origin=origin,
            customer_id=customer_id,
        )
        return rows, total

    async def create(
        self,
        *,
        origin: str | SaleOrigin,
        items: list[SaleItemCreateRequest],
        payment: SalePaymentCreateRequest,
        customer_id: UUID | None = None,
        inspection_item_id: UUID | None = None,
        notes: str | None = None,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Sale:
        try:
            origin_value = (
                origin.value
                if isinstance(origin, SaleOrigin)
                else SaleOrigin(str(origin).strip().upper()).value
            )
        except ValueError as exc:
            raise ValidationError(
                "مصدر البيع غير صالح",
                details={"field": "origin"},
            ) from exc

        if not items:
            raise ValidationError(
                "يجب تقديم فستان واحد على الأقل للبيع",
                details={"field": "items"},
            )

        dress_ids = [item.dress_id for item in items]
        if len(set(dress_ids)) != len(dress_ids):
            raise ValidationError(
                "لا يجوز تكرار الفستان في نفس فاتورة البيع",
                details={"field": "items"},
            )

        if origin_value == SaleOrigin.MANDATORY_DAMAGE_PURCHASE.value:
            return await self._create_mandatory(
                items=items,
                payment=payment,
                customer_id=customer_id,
                inspection_item_id=inspection_item_id,
                notes=notes,
                actor_id=actor_id,
                actor_username=actor_username,
                ip_address=ip_address,
            )
        if origin_value == SaleOrigin.NORMAL_SALE.value:
            return await self._create_normal(
                items=items,
                payment=payment,
                customer_id=customer_id,
                notes=notes,
                actor_id=actor_id,
                actor_username=actor_username,
                ip_address=ip_address,
            )
        raise ValidationError("مصدر البيع غير صالح", details={"field": "origin"})

    async def _create_normal(
        self,
        *,
        items: list[SaleItemCreateRequest],
        payment: SalePaymentCreateRequest,
        customer_id: UUID | None,
        notes: str | None,
        actor_id: UUID | None,
        actor_username: str | None,
        ip_address: str | None,
    ) -> Sale:
        if customer_id is not None:
            customer = await self.customers.get_by_id(customer_id)
            if customer is None or customer.is_deleted:
                raise NotFoundError("العميل غير موجود")

        locked = await self._lock_dresses(sorted({item.dress_id for item in items}))
        allow_override = await self.settings.get_bool(
            SettingKey.ALLOW_MANUAL_SALE_PRICE_OVERRIDE.value
        )

        line_rows: list[tuple[Any, int, int, str | None]] = []
        for item in items:
            dress = locked[item.dress_id]
            if not dress.is_active:
                raise ValidationError(
                    "الفستان غير نشط",
                    details={"dress_id": str(dress.id)},
                )
            if dress.status == DressStatus.RUINED_PENDING_SALE.value:
                raise ValidationError(
                    "يجب إتمام بيع الضرر الإلزامي لهذا الفستان",
                    details={"dress_id": str(dress.id), "status": dress.status},
                )
            if dress.status != DressStatus.AVAILABLE.value:
                raise ValidationError(
                    "الفستان غير متاح للبيع",
                    details={"dress_id": str(dress.id), "status": dress.status},
                )
            await self._reject_future_reservation(dress.id)
            default_price = int(dress.default_sale_price)
            actual = default_price if item.actual_sale_price is None else int(item.actual_sale_price)
            if actual < 1:
                raise ValidationError(
                    "سعر البيع غير صالح",
                    details={"dress_id": str(dress.id), "field": "actual_sale_price"},
                )
            if not allow_override and actual != default_price:
                raise ValidationError(
                    "تعديل سعر البيع معطل في الإعدادات",
                    details={"dress_id": str(dress.id), "default": default_price, "actual": actual},
                )
            line_rows.append(
                (
                    dress,
                    default_price,
                    actual,
                    _normalize_notes(item.notes, max_length=1000, field="item.notes"),
                )
            )

        return await self._persist_sale(
            origin=SaleOrigin.NORMAL_SALE.value,
            line_rows=line_rows,
            payment=payment,
            customer_id=customer_id,
            rental_id=None,
            return_id=None,
            inspection_id=None,
            inspection_item_id=None,
            notes=notes,
            target_status=DressStatus.SOLD,
            actor_id=actor_id,
            actor_username=actor_username,
            ip_address=ip_address,
        )

    async def _create_mandatory(
        self,
        *,
        items: list[SaleItemCreateRequest],
        payment: SalePaymentCreateRequest,
        customer_id: UUID | None,
        inspection_item_id: UUID | None,
        notes: str | None,
        actor_id: UUID | None,
        actor_username: str | None,
        ip_address: str | None,
    ) -> Sale:
        if inspection_item_id is None:
            raise ValidationError(
                "معرف عنصر الفحص مطلوب للبيع الإلزامي",
                details={"field": "inspection_item_id"},
            )
        if customer_id is None:
            raise ValidationError(
                "العميل مطلوب للبيع الإلزامي",
                details={"field": "customer_id"},
            )
        if len(items) != 1:
            raise ValidationError(
                "البيع الإلزامي يقبل فستاناً واحداً فقط",
                details={"field": "items"},
            )

        existing_sale_item = await self.items.get_by_inspection_item_id(inspection_item_id)
        if existing_sale_item is not None:
            raise ConflictError(
                "تم بيع عنصر الفحص مسبقاً",
                details={"inspection_item_id": str(inspection_item_id)},
            )

        insp_item = await self.inspection_items.get_by_id(inspection_item_id)
        if insp_item is None or insp_item.is_deleted:
            raise NotFoundError("عنصر الفحص غير موجود")

        if insp_item.condition != DressCondition.MAJOR_DAMAGE.value:
            raise ValidationError(
                "عنصر الفحص ليس ضرراً جسيماً",
                details={"inspection_item_id": str(inspection_item_id)},
            )
        if not insp_item.send_to_ruined:
            raise ValidationError(
                "عنصر الفحص غير محدد للإهلاك",
                details={"inspection_item_id": str(inspection_item_id)},
            )
        if insp_item.repair_penalty_amount is not None:
            raise ValidationError(
                "ضرر جسيم مع غرامة لا يتطلب بيعاً إلزامياً",
                details={"inspection_item_id": str(inspection_item_id)},
            )

        item_input = items[0]
        if item_input.dress_id != insp_item.dress_id:
            raise ValidationError(
                "الفستان لا يطابق عنصر الفحص",
                details={
                    "dress_id": str(item_input.dress_id),
                    "inspection_dress_id": str(insp_item.dress_id),
                },
            )

        inspection = await self.inspections.get_by_id(insp_item.inspection_id)
        if inspection is None or inspection.is_deleted:
            raise NotFoundError("سجل الفحص غير موجود")
        if inspection.status != InspectionStatus.COMPLETED.value:
            raise ValidationError(
                "يجب اكتمال الفحص قبل البيع الإلزامي",
                details={"inspection_status": inspection.status},
            )

        ret = await self.returns.get_by_id(inspection.return_id)
        if ret is None or ret.is_deleted:
            raise NotFoundError("سجل الإرجاع غير موجود")

        rental = await self.rentals.get_by_id(ret.rental_id)
        if rental is None or rental.is_deleted:
            raise NotFoundError("سجل الإيجار غير موجود")

        if customer_id != rental.customer_id:
            raise BusinessError(
                "العميل لا يطابق عميل الإيجار",
                code="sale_customer_mismatch",
                details={
                    "customer_id": str(customer_id),
                    "rental_customer_id": str(rental.customer_id),
                },
            )

        customer = await self.customers.get_by_id(customer_id)
        if customer is None or customer.is_deleted:
            raise NotFoundError("العميل غير موجود")

        locked = await self._lock_dresses([insp_item.dress_id])
        dress = locked[insp_item.dress_id]
        if dress.status != DressStatus.RUINED_PENDING_SALE.value:
            raise ValidationError(
                "الفستان ليس بانتظار بيع إلزامي",
                details={"dress_id": str(dress.id), "status": dress.status},
            )
        await self._reject_future_reservation(dress.id)

        allow_override = await self.settings.get_bool(
            SettingKey.ALLOW_MANUAL_SALE_PRICE_OVERRIDE.value
        )
        default_price = int(dress.default_sale_price)
        actual = (
            default_price
            if item_input.actual_sale_price is None
            else int(item_input.actual_sale_price)
        )
        if actual < 1:
            raise ValidationError(
                "سعر البيع غير صالح",
                details={"dress_id": str(dress.id), "field": "actual_sale_price"},
            )
        if not allow_override and actual != default_price:
            raise ValidationError(
                "تعديل سعر البيع معطل في الإعدادات",
                details={"dress_id": str(dress.id), "default": default_price, "actual": actual},
            )

        line_rows = [
            (
                dress,
                default_price,
                actual,
                _normalize_notes(item_input.notes, max_length=1000, field="item.notes"),
            )
        ]

        return await self._persist_sale(
            origin=SaleOrigin.MANDATORY_DAMAGE_PURCHASE.value,
            line_rows=line_rows,
            payment=payment,
            customer_id=customer_id,
            rental_id=rental.id,
            return_id=ret.id,
            inspection_id=inspection.id,
            inspection_item_id=insp_item.id,
            notes=notes,
            target_status=DressStatus.SOLD,
            actor_id=actor_id,
            actor_username=actor_username,
            ip_address=ip_address,
        )

    async def _lock_dresses(self, dress_ids: list[UUID]) -> dict[UUID, Any]:
        locked: dict[UUID, Any] = {}
        for dress_id in dress_ids:
            dress = await self.dresses.get_for_update(dress_id)
            if dress is None:
                raise NotFoundError("الفستان غير موجود", details={"dress_id": str(dress_id)})
            locked[dress_id] = dress
        return locked

    async def _reject_future_reservation(self, dress_id: UUID) -> None:
        now = utc_now()
        blocks = await self.calendar.get_timeline(dress_id, window_from=now)
        for block in blocks:
            if block.block_type != CalendarBlockType.RESERVATION.value:
                continue
            if ensure_utc(block.end_at) > now:
                raise BusinessError(
                    "لا يمكن بيع الفستان لوجود حجز مستقبلي مؤكد عليه.",
                    code="sale_blocked_by_future_reservation",
                    details={"dress_id": str(dress_id), "block_id": str(block.id)},
                )

    async def _persist_sale(
        self,
        *,
        origin: str,
        line_rows: list[tuple[Any, int, int, str | None]],
        payment: SalePaymentCreateRequest,
        customer_id: UUID | None,
        rental_id: UUID | None,
        return_id: UUID | None,
        inspection_id: UUID | None,
        inspection_item_id: UUID | None,
        notes: str | None,
        target_status: DressStatus,
        actor_id: UUID | None,
        actor_username: str | None,
        ip_address: str | None,
    ) -> Sale:
        total_amount = sum(actual for _, _, actual, _ in line_rows)
        pay_amount = int(payment.amount)
        if pay_amount < 1:
            raise ValidationError(
                "مبلغ الدفعة يجب أن يكون أكبر من صفر",
                details={"field": "payment.amount"},
            )
        if pay_amount != total_amount:
            raise ValidationError(
                "مبلغ الدفعة يجب أن يساوي إجمالي البيع",
                details={"payment_amount": pay_amount, "total_amount": total_amount},
            )

        try:
            payment_method = SalePaymentMethod(
                str(payment.payment_method).strip().upper()
                if not isinstance(payment.payment_method, SalePaymentMethod)
                else payment.payment_method.value
            ).value
        except ValueError as exc:
            raise ValidationError(
                "طريقة الدفع غير صالحة",
                details={"field": "payment.payment_method"},
            ) from exc

        ref = None
        if payment.reference_number is not None:
            ref = payment.reference_number.strip() or None
            if ref is not None and len(ref) > 100:
                raise ValidationError(
                    "رقم المرجع أطول من الحد المسموح",
                    details={"field": "payment.reference_number", "max_length": 100},
                )

        sale_number = await self.numbers.generate_next()
        now = utc_now()
        sale = Sale(
            sale_number=sale_number,
            origin=origin,
            status=SaleStatus.COMPLETED.value,
            customer_id=customer_id,
            rental_id=rental_id,
            return_id=return_id,
            inspection_id=inspection_id,
            total_amount=total_amount,
            sold_at=now,
            sold_by=actor_id,
            notes=_normalize_notes(notes, max_length=2000, field="notes"),
            created_by=actor_id,
            updated_by=actor_id,
        )
        sale = await self.sales.add(sale)

        price_overrides: list[dict[str, Any]] = []
        for dress, default_price, actual, item_notes in line_rows:
            item_insp_id = inspection_item_id if inspection_item_id is not None else None
            await self.items.add(
                SaleItem(
                    sale_id=sale.id,
                    dress_id=dress.id,
                    default_sale_price=default_price,
                    actual_sale_price=actual,
                    inspection_item_id=item_insp_id,
                    notes=item_notes,
                    created_by=actor_id,
                    updated_by=actor_id,
                )
            )
            if actual != default_price:
                price_overrides.append(
                    {
                        "dress_id": str(dress.id),
                        "default_sale_price": default_price,
                        "actual_sale_price": actual,
                    }
                )

        pay = SalePayment(
            sale_id=sale.id,
            amount=pay_amount,
            payment_method=payment_method,
            received_at=(
                ensure_utc(payment.received_at) if payment.received_at is not None else now
            ),
            received_by=actor_id,
            reference_number=ref,
            notes=_normalize_notes(payment.notes, max_length=1000, field="payment.notes"),
            created_by=actor_id,
            updated_by=actor_id,
        )
        await self.payments.add(pay)

        for dress, _, _, _ in line_rows:
            await self.dress_status.change_status(
                dress.id,
                target_status,
                reason="sale_completed",
                actor_id=actor_id,
                actor_username=actor_username,
                ip_address=ip_address,
            )

        await self.audit.record_create(
            module="sales",
            entity_type="Sale",
            entity_id=sale.id,
            new_values=_snapshot(sale),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="تم إنشاء فاتورة البيع",
        )
        await self.audit.record(
            module="sales",
            entity_type="Sale",
            entity_id=sale.id,
            action=AuditAction.COMPLETE,
            old_values=None,
            new_values=_snapshot(sale),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="تم إتمام البيع",
        )
        if price_overrides:
            await self.audit.record(
                module="sales",
                entity_type="Sale",
                entity_id=sale.id,
                action=AuditAction.CUSTOM,
                old_values=None,
                new_values=_snapshot(sale),
                user_id=actor_id,
                username=actor_username,
                ip_address=ip_address,
                message="تم بيع بسعر مختلف عن الافتراضي",
                metadata={"overrides": price_overrides},
            )
        if origin == SaleOrigin.MANDATORY_DAMAGE_PURCHASE.value:
            await self.audit.record(
                module="sales",
                entity_type="Sale",
                entity_id=sale.id,
                action=AuditAction.CUSTOM,
                old_values=None,
                new_values=_snapshot(sale),
                user_id=actor_id,
                username=actor_username,
                ip_address=ip_address,
                message="تم إتمام البيع الإلزامي للضرر الجسيم",
                metadata={"inspection_item_id": str(inspection_item_id)},
            )

        return await self.get(sale.id)

