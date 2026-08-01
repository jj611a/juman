"""RentalService — walk-in and reservation handover."""

from __future__ import annotations

import math
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.calendar.constants import CalendarBlockType
from app.modules.calendar.services.calendar import CalendarService
from app.modules.customers.repositories.customer import CustomerRepository
from app.modules.inventory.constants import DressStatus
from app.modules.inventory.repositories.dress import DressRepository
from app.modules.inventory.services.dress_status import DressStatusService
from app.modules.rentals.constants import InitialPaymentType, RentalSortField, RentalStatus
from app.modules.rentals.models.rental import Rental
from app.modules.rentals.models.rental_item import RentalItem
from app.modules.rentals.repositories.rental import RentalItemRepository, RentalRepository
from app.modules.rentals.services.rental_number import RentalNumberService
from app.modules.reservations.constants import ReservationStatus
from app.modules.reservations.services.reservation import ReservationService
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.services.base import BaseService
from app.utils.datetime import ensure_utc, utc_now


def _snapshot(rental: Rental, items: list[RentalItem] | None = None) -> dict[str, Any]:
    live = items if items is not None else [i for i in (rental.items or []) if not i.is_deleted]
    return {
        "rental_number": rental.rental_number,
        "customer_id": str(rental.customer_id),
        "reservation_id": str(rental.reservation_id) if rental.reservation_id else None,
        "rental_at": ensure_utc(rental.rental_at).isoformat(),
        "expected_return_at": ensure_utc(rental.expected_return_at).isoformat(),
        "status": rental.status,
        "initial_payment_type": rental.initial_payment_type,
        "initial_payment_rate": rental.initial_payment_rate,
        "initial_payment_value": rental.initial_payment_value,
        "estimated_total": rental.estimated_total,
        "remaining_balance": int(rental.estimated_total) - int(rental.initial_payment_value),
        "notes": rental.notes,
        "items": [
            {
                "id": str(item.id),
                "dress_id": str(item.dress_id),
                "agreed_daily_rental_price": item.agreed_daily_rental_price,
                "expected_rental_days": item.expected_rental_days,
                "calendar_block_id": str(item.calendar_block_id) if item.calendar_block_id else None,
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


def _expected_days(rental_at: datetime, expected_return_at: datetime) -> int:
    delta = ensure_utc(expected_return_at) - ensure_utc(rental_at)
    days = math.ceil(delta.total_seconds() / 86400)
    return max(1, days)


def _validate_window(rental_at: datetime, expected_return_at: datetime) -> tuple[datetime, datetime]:
    if rental_at.tzinfo is None or expected_return_at.tzinfo is None:
        raise ValidationError(
            "يجب أن تكون أوقات الإيجار بمنطقة زمنية",
            details={"field": "rental_at"},
        )
    rental_at = ensure_utc(rental_at)
    expected_return_at = ensure_utc(expected_return_at)
    if not (expected_return_at > rental_at):
        raise ValidationError(
            "وقت الإرجاع المتوقع يجب أن يكون بعد وقت الإيجار",
            details={"field": "expected_return_at"},
        )
    return rental_at, expected_return_at


class RentalService(BaseService):
    """Create Active rentals from walk-in or confirmed reservation."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        rentals: RentalRepository | None = None,
        items: RentalItemRepository | None = None,
        numbers: RentalNumberService | None = None,
        customers: CustomerRepository | None = None,
        dresses: DressRepository | None = None,
        calendar: CalendarService | None = None,
        dress_status: DressStatusService | None = None,
        reservations: ReservationService | None = None,
        settings: SettingService | None = None,
        audit: AuditService | None = None,
    ) -> None:
        super().__init__(session)
        self.rentals = rentals or RentalRepository(session)
        self.items = items or RentalItemRepository(session)
        self.settings = settings or SettingService(session)
        self.numbers = numbers or RentalNumberService(
            session,
            settings=self.settings,
            rentals=self.rentals,
        )
        self.customers = customers or CustomerRepository(session)
        self.dresses = dresses or DressRepository(session)
        audit_svc = audit or AuditService(session)
        self.calendar = calendar or CalendarService(session, audit=audit_svc)
        self.dress_status = dress_status or DressStatusService(session, audit=audit_svc)
        self.reservations = reservations or ReservationService(
            session,
            settings=self.settings,
            calendar=self.calendar,
            dress_status=self.dress_status,
            audit=audit_svc,
        )
        self.audit = audit_svc

    async def _require_customer(self, customer_id: UUID) -> None:
        if await self.customers.get_by_id(customer_id) is None:
            raise NotFoundError("العميل غير موجود")

    async def _require_dress(self, dress_id: UUID):
        dress = await self.dresses.get_by_id(dress_id)
        if dress is None:
            raise NotFoundError("الفستان غير موجود")
        return dress

    async def _load_live_items(self, rental_id: UUID) -> list[RentalItem]:
        return await self.items.list_live_for_rental(rental_id)

    async def get(self, rental_id: UUID) -> Rental:
        rental = await self.rentals.get_by_id(rental_id)
        if rental is None:
            raise NotFoundError("عقد الإيجار غير موجود")
        self.session.expire(rental, ["items"])
        await self.session.refresh(rental, attribute_names=["items"])
        return rental

    async def list(
        self,
        *,
        status: str | None = None,
        customer_id: UUID | None = None,
        reservation_id: UUID | None = None,
        sort_by: RentalSortField | str = RentalSortField.CREATED_AT,
        sort_dir: str = "desc",
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Rental], int]:
        allowed = {field.value for field in RentalSortField}
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
                status = RentalStatus(status.strip().upper()).value
            except ValueError as exc:
                raise ValidationError(
                    "حالة الإيجار غير صالحة",
                    details={"field": "status"},
                ) from exc
        rows = await self.rentals.list_filtered(
            status=status,
            customer_id=customer_id,
            reservation_id=reservation_id,
            sort_by=sort_key,
            sort_dir=direction,
            offset=offset,
            limit=limit,
        )
        total = await self.rentals.count_filtered(
            status=status,
            customer_id=customer_id,
            reservation_id=reservation_id,
        )
        return rows, total

    async def _compute_payment(
        self,
        *,
        estimated_total: int,
        payment_type: str | InitialPaymentType,
        payment_value: int | None,
        payment_rate: int | None,
    ) -> tuple[str, int | None, int, int]:
        try:
            ptype = (
                payment_type
                if isinstance(payment_type, InitialPaymentType)
                else InitialPaymentType(str(payment_type).strip().upper())
            )
        except ValueError as exc:
            raise ValidationError(
                "نوع الدفعة الأولية غير صالح",
                details={"field": "initial_payment_type"},
            ) from exc

        if estimated_total < 0:
            raise ValidationError("الإجمالي التقديري غير صالح")

        if ptype == InitialPaymentType.FIXED_AMOUNT:
            if payment_value is None:
                raise ValidationError(
                    "قيمة الدفعة الأولية مطلوبة",
                    details={"field": "initial_payment_value"},
                )
            if payment_value < 0 or payment_value > estimated_total:
                raise ValidationError(
                    "قيمة الدفعة الأولية يجب أن تكون بين صفر والإجمالي التقديري",
                    details={"field": "initial_payment_value"},
                )
            return ptype.value, None, payment_value, estimated_total - payment_value

        max_pct = await self.settings.get_int(
            SettingKey.MAXIMUM_INITIAL_PAYMENT_PERCENTAGE.value
        )
        if max_pct < 1:
            raise ValidationError(
                "الدفع بنسبة مئوية غير مسموح حسب إعدادات النظام",
                details={"field": "initial_payment_type"},
            )
        if payment_rate is None:
            raise ValidationError(
                "نسبة الدفعة الأولية مطلوبة",
                details={"field": "initial_payment_rate"},
            )
        if payment_rate < 1 or payment_rate > max_pct:
            raise ValidationError(
                "نسبة الدفعة الأولية خارج الحد المسموح",
                details={
                    "field": "initial_payment_rate",
                    "min": 1,
                    "max": max_pct,
                },
            )
        value = int(round(estimated_total * payment_rate / 100))
        return ptype.value, payment_rate, value, estimated_total - value

    async def _build_walk_in_specs(
        self,
        raw_items: list[dict[str, Any]],
        *,
        days: int,
    ) -> list[dict[str, Any]]:
        if not raw_items:
            raise ValidationError(
                "يجب أن يحتوي الإيجار على فستان واحد على الأقل",
                details={"field": "items"},
            )
        seen: set[UUID] = set()
        specs: list[dict[str, Any]] = []
        for raw in raw_items:
            dress_id = raw["dress_id"]
            if dress_id in seen:
                raise ValidationError(
                    "لا يمكن تكرار الفستان في نفس الإيجار",
                    details={"field": "dress_id"},
                )
            seen.add(dress_id)
            dress = await self._require_dress(dress_id)
            price = raw.get("agreed_daily_rental_price")
            if price is None:
                price = int(dress.default_daily_rental_price)
            if not isinstance(price, int) or price < 0:
                raise ValidationError(
                    "سعر الإيجار اليومي المتفق عليه غير صالح",
                    details={"field": "agreed_daily_rental_price"},
                )
            specs.append(
                {
                    "dress_id": dress_id,
                    "agreed_daily_rental_price": price,
                    "expected_rental_days": days,
                    "notes": _normalize_notes(
                        raw.get("notes"),
                        max_length=1000,
                        field="items.notes",
                    ),
                }
            )
        return specs

    async def create(
        self,
        *,
        customer_id: UUID,
        expected_return_at: datetime,
        initial_payment_type: str | InitialPaymentType,
        rental_at: datetime | None = None,
        reservation_id: UUID | None = None,
        initial_payment_value: int | None = None,
        initial_payment_rate: int | None = None,
        notes: str | None = None,
        items: list[dict[str, Any]] | None = None,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Rental:
        """Create an ACTIVE rental (walk-in or from confirmed reservation)."""
        rental_at = rental_at or utc_now()

        if reservation_id is not None:
            reservation = await self.reservations.get(reservation_id)
            if reservation.status != ReservationStatus.CONFIRMED.value:
                raise ValidationError(
                    "يمكن تحويل الحجوزات المؤكدة فقط إلى إيجار",
                    details={"status": reservation.status},
                )
            if reservation.customer_id != customer_id:
                raise ValidationError(
                    "عميل الإيجار يجب أن يطابق عميل الحجز",
                    details={"field": "customer_id"},
                )
            await self._require_customer(customer_id)
            rental_at = utc_now()
            expected_return_at = ensure_utc(reservation.expected_return_at)
            rental_at, expected_return_at = _validate_window(rental_at, expected_return_at)
            days = _expected_days(rental_at, expected_return_at)
            res_items = [i for i in (reservation.items or []) if not i.is_deleted]
            if not res_items:
                raise ValidationError("يجب أن يحتوي الحجز على فستان واحد على الأقل")
            specs = [
                {
                    "dress_id": item.dress_id,
                    "agreed_daily_rental_price": int(item.reserved_daily_rental_price),
                    "expected_rental_days": days,
                    "notes": item.notes,
                    "reservation_item": item,
                }
                for item in res_items
            ]
            # Remove reservation calendar blocks before creating rental blocks
            for spec in specs:
                ritem = spec["reservation_item"]
                if ritem.calendar_block_id is not None:
                    try:
                        await self.calendar.remove_block(
                            ritem.calendar_block_id,
                            actor_id=actor_id,
                            actor_username=actor_username,
                            ip_address=ip_address,
                        )
                    except NotFoundError:
                        pass
        else:
            await self._require_customer(customer_id)
            rental_at, expected_return_at = _validate_window(rental_at, expected_return_at)
            days = _expected_days(rental_at, expected_return_at)
            specs = await self._build_walk_in_specs(items or [], days=days)
            for spec in specs:
                available = await self.calendar.is_available(
                    spec["dress_id"],
                    rental_at,
                    expected_return_at,
                )
                if not available:
                    conflicts = await self.calendar.get_conflicts(
                        spec["dress_id"],
                        rental_at,
                        expected_return_at,
                    )
                    raise ConflictError(
                        "الفستان غير متاح في الفترة المطلوبة",
                        details={
                            "dress_id": str(spec["dress_id"]),
                            "conflicts": [c.as_dict() for c in conflicts],
                        },
                    )

        estimated_total = sum(
            int(s["agreed_daily_rental_price"]) * int(s["expected_rental_days"]) for s in specs
        )
        ptype, rate, value, _remaining = await self._compute_payment(
            estimated_total=estimated_total,
            payment_type=initial_payment_type,
            payment_value=initial_payment_value,
            payment_rate=initial_payment_rate,
        )

        number = await self.numbers.generate_next()
        rental = Rental(
            rental_number=number,
            customer_id=customer_id,
            reservation_id=reservation_id,
            rental_at=rental_at,
            expected_return_at=expected_return_at,
            status=RentalStatus.ACTIVE.value,
            initial_payment_type=ptype,
            initial_payment_rate=rate,
            initial_payment_value=value,
            estimated_total=estimated_total,
            notes=_normalize_notes(notes, max_length=2000, field="notes"),
            created_by=actor_id,
            updated_by=actor_id,
        )
        rental = await self.rentals.add(rental)

        created_items: list[RentalItem] = []
        for spec in specs:
            item = RentalItem(
                rental_id=rental.id,
                dress_id=spec["dress_id"],
                agreed_daily_rental_price=spec["agreed_daily_rental_price"],
                expected_rental_days=spec["expected_rental_days"],
                notes=spec.get("notes"),
                created_by=actor_id,
                updated_by=actor_id,
            )
            item = await self.items.add(item)

            block = await self.calendar.create_block(
                dress_id=spec["dress_id"],
                block_type=CalendarBlockType.RENTAL,
                start_at=rental_at,
                end_at=expected_return_at,
                reference_module="rental",
                reference_id=rental.id,
                notes=f"إيجار {rental.rental_number}",
                actor_id=actor_id,
                actor_username=actor_username,
                ip_address=ip_address,
            )
            item = await self.items.update_fields(
                item,
                calendar_block_id=block.id,
                updated_by=actor_id,
                updated_at=utc_now(),
            )
            created_items.append(item)

            target_from_reservation = reservation_id is not None
            await self.dress_status.change_status(
                spec["dress_id"],
                DressStatus.RENTED,
                reason=(
                    f"تحويل الحجز إلى إيجار {rental.rental_number}"
                    if target_from_reservation
                    else f"إيجار مباشر {rental.rental_number}"
                ),
                actor_id=actor_id,
                actor_username=actor_username,
                ip_address=ip_address,
            )

        if reservation_id is not None:
            await self.reservations.mark_converted_to_rental(
                reservation_id,
                actor_id=actor_id,
                actor_username=actor_username,
                ip_address=ip_address,
            )

        await self.audit.record_create(
            module="rentals",
            entity_type="Rental",
            entity_id=rental.id,
            new_values=_snapshot(rental, created_items),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="تم إنشاء عقد إيجار",
        )
        self.session.expire(rental, ["items"])
        return await self.get(rental.id)

    async def update(
        self,
        rental_id: UUID,
        *,
        notes: str | None = None,
        clear_notes: bool = False,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Rental:
        """Update notes on an Active rental only."""
        rental = await self.get(rental_id)
        if rental.status != RentalStatus.ACTIVE.value:
            raise ValidationError(
                "يمكن تعديل عقود الإيجار النشطة فقط",
                details={"status": rental.status},
            )
        old_values = _snapshot(rental, await self._load_live_items(rental.id))
        fields: dict[str, object] = {
            "updated_by": actor_id,
            "updated_at": utc_now(),
        }
        if clear_notes:
            fields["notes"] = None
        elif notes is not None:
            fields["notes"] = _normalize_notes(notes, max_length=2000, field="notes")
        else:
            raise ValidationError("لا توجد حقول للتحديث")

        rental = await self.rentals.update_fields(rental, **fields)
        rental = await self.get(rental.id)
        await self.audit.record_update(
            module="rentals",
            entity_type="Rental",
            entity_id=rental.id,
            old_values=old_values,
            new_values=_snapshot(rental, await self._load_live_items(rental.id)),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="تم تحديث عقد الإيجار",
        )
        return rental

    async def cancel(
        self,
        rental_id: UUID,
        *,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> None:
        """v1: always reject — Returns module owns post-handover reverse."""
        rental = await self.get(rental_id)
        await self.audit.record(
            module="rentals",
            entity_type="Rental",
            entity_id=rental.id,
            action=AuditAction.CANCEL,
            old_values=_snapshot(rental, await self._load_live_items(rental.id)),
            new_values=None,
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="محاولة إلغاء إيجار مرفوضة — يتطلب الإرجاع",
            metadata={"code": "rental_cancel_requires_return", "rejected": True},
        )
        # Persist cancel-attempt audit before the ValidationError rolls back the request.
        await self.session.commit()
        raise ValidationError(
            "لا يمكن إلغاء عملية التأجير بعد تسليم الفستان. يجب تنفيذ عملية الإرجاع.",
            details={"code": "rental_cancel_requires_return"},
        )

    async def mark_return_pending(
        self,
        rental_id: UUID,
        *,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Rental:
        """Mark an Active rental as RETURN_PENDING (called by Returns after receipt)."""
        rental = await self.get(rental_id)
        if rental.status != RentalStatus.ACTIVE.value:
            raise ValidationError(
                "يمكن إرجاع عقود الإيجار النشطة فقط",
                details={"status": rental.status},
            )
        old_values = _snapshot(rental, await self._load_live_items(rental.id))
        rental = await self.rentals.update_fields(
            rental,
            status=RentalStatus.RETURN_PENDING.value,
            updated_by=actor_id,
            updated_at=utc_now(),
        )
        rental = await self.get(rental.id)
        await self.audit.record(
            module="rentals",
            entity_type="Rental",
            entity_id=rental.id,
            action=AuditAction.RETURN,
            old_values=old_values,
            new_values=_snapshot(rental, await self._load_live_items(rental.id)),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="تم تسجيل إرجاع عقد الإيجار",
        )
        return rental
