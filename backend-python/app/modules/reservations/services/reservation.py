"""ReservationService — draft holds, confirm via Calendar + Status engines."""

from __future__ import annotations

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
from app.modules.reservations.constants import ReservationSortField, ReservationStatus
from app.modules.reservations.models.reservation import Reservation
from app.modules.reservations.models.reservation_item import ReservationItem
from app.modules.reservations.repositories.reservation import (
    ReservationItemRepository,
    ReservationRepository,
)
from app.modules.reservations.services.reservation_number import ReservationNumberService
from app.modules.settings.services.setting import SettingService
from app.services.base import BaseService
from app.utils.datetime import ensure_utc, utc_now


def _snapshot(reservation: Reservation, items: list[ReservationItem] | None = None) -> dict[str, Any]:
    live_items = items if items is not None else [
        i for i in (reservation.items or []) if not i.is_deleted
    ]
    return {
        "reservation_number": reservation.reservation_number,
        "customer_id": str(reservation.customer_id),
        "reservation_at": ensure_utc(reservation.reservation_at).isoformat(),
        "rental_start_at": ensure_utc(reservation.rental_start_at).isoformat(),
        "expected_return_at": ensure_utc(reservation.expected_return_at).isoformat(),
        "status": reservation.status,
        "notes": reservation.notes,
        "items": [
            {
                "id": str(item.id),
                "dress_id": str(item.dress_id),
                "reserved_daily_rental_price": item.reserved_daily_rental_price,
                "notes": item.notes,
                "calendar_block_id": str(item.calendar_block_id)
                if item.calendar_block_id
                else None,
            }
            for item in live_items
        ],
    }


def _validate_dates(
    reservation_at: datetime,
    rental_start_at: datetime,
    expected_return_at: datetime,
) -> tuple[datetime, datetime, datetime]:
    if reservation_at.tzinfo is None or rental_start_at.tzinfo is None or expected_return_at.tzinfo is None:
        raise ValidationError(
            "يجب أن تكون أوقات الحجز بمنطقة زمنية",
            details={"field": "reservation_at"},
        )
    reservation_at = ensure_utc(reservation_at)
    rental_start_at = ensure_utc(rental_start_at)
    expected_return_at = ensure_utc(expected_return_at)
    if not (rental_start_at > reservation_at):
        raise ValidationError(
            "وقت بداية الإيجار يجب أن يكون بعد وقت الحجز",
            details={"field": "rental_start_at"},
        )
    if not (expected_return_at > rental_start_at):
        raise ValidationError(
            "وقت الإرجاع المتوقع يجب أن يكون بعد بداية الإيجار",
            details={"field": "expected_return_at"},
        )
    return reservation_at, rental_start_at, expected_return_at


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


class ReservationService(BaseService):
    """Manage reservation drafts and confirm/cancel/expire via engines."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        reservations: ReservationRepository | None = None,
        items: ReservationItemRepository | None = None,
        numbers: ReservationNumberService | None = None,
        customers: CustomerRepository | None = None,
        dresses: DressRepository | None = None,
        calendar: CalendarService | None = None,
        dress_status: DressStatusService | None = None,
        settings: SettingService | None = None,
        audit: AuditService | None = None,
    ) -> None:
        super().__init__(session)
        self.reservations = reservations or ReservationRepository(session)
        self.items = items or ReservationItemRepository(session)
        self.settings = settings or SettingService(session)
        self.numbers = numbers or ReservationNumberService(
            session,
            settings=self.settings,
            reservations=self.reservations,
        )
        self.customers = customers or CustomerRepository(session)
        self.dresses = dresses or DressRepository(session)
        self.calendar = calendar or CalendarService(session, audit=AuditService(session))
        self.dress_status = dress_status or DressStatusService(session, audit=AuditService(session))
        self.audit = audit or AuditService(session)

    async def _require_customer(self, customer_id: UUID) -> None:
        customer = await self.customers.get_by_id(customer_id)
        if customer is None:
            raise NotFoundError("العميل غير موجود")

    async def _require_dress(self, dress_id: UUID):
        dress = await self.dresses.get_by_id(dress_id)
        if dress is None:
            raise NotFoundError("الفستان غير موجود")
        return dress

    def _live_items(self, reservation: Reservation) -> list[ReservationItem]:
        return [i for i in (reservation.items or []) if not i.is_deleted]

    async def _load_live_items(self, reservation_id: UUID) -> list[ReservationItem]:
        return await self.items.list_live_for_reservation(reservation_id)

    async def get(self, reservation_id: UUID) -> Reservation:
        """Return a live reservation with items freshly loaded."""
        reservation = await self.reservations.get_by_id(reservation_id)
        if reservation is None:
            raise NotFoundError("الحجز غير موجود")
        self.session.expire(reservation, ["items"])
        await self.session.refresh(reservation, attribute_names=["items"])
        return reservation

    async def list(
        self,
        *,
        status: str | None = None,
        customer_id: UUID | None = None,
        rental_from: datetime | None = None,
        rental_to: datetime | None = None,
        sort_by: ReservationSortField | str = ReservationSortField.CREATED_AT,
        sort_dir: str = "desc",
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Reservation], int]:
        """List live reservations with filters."""
        allowed = {field.value for field in ReservationSortField}
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
        if status is not None:
            try:
                status = ReservationStatus(status.strip().upper()).value
            except ValueError as exc:
                raise ValidationError(
                    "حالة الحجز غير صالحة",
                    details={"field": "status"},
                ) from exc
        items = await self.reservations.list_filtered(
            status=status,
            customer_id=customer_id,
            rental_from=rental_from,
            rental_to=rental_to,
            sort_by=sort_key,
            sort_dir=direction,
            offset=offset,
            limit=limit,
        )
        total = await self.reservations.count_filtered(
            status=status,
            customer_id=customer_id,
            rental_from=rental_from,
            rental_to=rental_to,
        )
        return items, total

    async def _build_item_specs(
        self,
        raw_items: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        if not raw_items:
            raise ValidationError(
                "يجب أن يحتوي الحجز على فستان واحد على الأقل",
                details={"field": "items"},
            )
        seen: set[UUID] = set()
        specs: list[dict[str, Any]] = []
        for raw in raw_items:
            dress_id = raw["dress_id"]
            if dress_id in seen:
                raise ValidationError(
                    "لا يمكن تكرار الفستان في نفس الحجز",
                    details={"field": "dress_id", "dress_id": str(dress_id)},
                )
            seen.add(dress_id)
            dress = await self._require_dress(dress_id)
            price = raw.get("reserved_daily_rental_price")
            if price is None:
                price = int(dress.default_daily_rental_price)
            if not isinstance(price, int) or price < 0:
                raise ValidationError(
                    "سعر الإيجار اليومي المتفق عليه غير صالح",
                    details={"field": "reserved_daily_rental_price"},
                )
            specs.append(
                {
                    "dress_id": dress_id,
                    "reserved_daily_rental_price": price,
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
        rental_start_at: datetime,
        expected_return_at: datetime,
        items: list[dict[str, Any]],
        reservation_at: datetime | None = None,
        notes: str | None = None,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Reservation:
        """Create a Draft reservation (no calendar / status side effects)."""
        await self._require_customer(customer_id)
        reservation_at = reservation_at or utc_now()
        reservation_at, rental_start_at, expected_return_at = _validate_dates(
            reservation_at,
            rental_start_at,
            expected_return_at,
        )
        specs = await self._build_item_specs(items)
        number = await self.numbers.generate_next()

        reservation = Reservation(
            reservation_number=number,
            customer_id=customer_id,
            reservation_at=reservation_at,
            rental_start_at=rental_start_at,
            expected_return_at=expected_return_at,
            status=ReservationStatus.DRAFT.value,
            notes=_normalize_notes(notes, max_length=2000, field="notes"),
            created_by=actor_id,
            updated_by=actor_id,
        )
        reservation = await self.reservations.add(reservation)

        created_items: list[ReservationItem] = []
        for spec in specs:
            item = ReservationItem(
                reservation_id=reservation.id,
                dress_id=spec["dress_id"],
                reserved_daily_rental_price=spec["reserved_daily_rental_price"],
                notes=spec["notes"],
                created_by=actor_id,
                updated_by=actor_id,
            )
            created_items.append(await self.items.add(item))

        await self.audit.record_create(
            module="reservations",
            entity_type="Reservation",
            entity_id=reservation.id,
            new_values=_snapshot(reservation, created_items),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="تم إنشاء حجز مسودة",
        )
        self.session.expire(reservation, ["items"])
        return await self.get(reservation.id)

    async def update(
        self,
        reservation_id: UUID,
        *,
        customer_id: UUID | None = None,
        reservation_at: datetime | None = None,
        rental_start_at: datetime | None = None,
        expected_return_at: datetime | None = None,
        notes: str | None = None,
        clear_notes: bool = False,
        items: list[dict[str, Any]] | None = None,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Reservation:
        """Update a Draft reservation only."""
        reservation = await self.get(reservation_id)
        if reservation.status != ReservationStatus.DRAFT.value:
            raise ValidationError(
                "يمكن تعديل الحجوزات المسودة فقط",
                details={"status": reservation.status},
            )
        old_values = _snapshot(reservation, await self._load_live_items(reservation.id))

        if customer_id is not None:
            await self._require_customer(customer_id)

        new_reservation_at = reservation_at if reservation_at is not None else ensure_utc(
            reservation.reservation_at
        )
        new_start = rental_start_at if rental_start_at is not None else ensure_utc(
            reservation.rental_start_at
        )
        new_end = expected_return_at if expected_return_at is not None else ensure_utc(
            reservation.expected_return_at
        )
        new_reservation_at, new_start, new_end = _validate_dates(
            new_reservation_at,
            new_start,
            new_end,
        )

        fields: dict[str, object] = {
            "reservation_at": new_reservation_at,
            "rental_start_at": new_start,
            "expected_return_at": new_end,
            "updated_by": actor_id,
            "updated_at": utc_now(),
        }
        if customer_id is not None:
            fields["customer_id"] = customer_id
        if clear_notes:
            fields["notes"] = None
        elif notes is not None:
            fields["notes"] = _normalize_notes(notes, max_length=2000, field="notes")

        reservation = await self.reservations.update_fields(reservation, **fields)

        if items is not None:
            specs = await self._build_item_specs(items)
            for existing in await self._load_live_items(reservation.id):
                await self.items.delete(existing, deleted_by=actor_id)
            for spec in specs:
                await self.items.add(
                    ReservationItem(
                        reservation_id=reservation.id,
                        dress_id=spec["dress_id"],
                        reserved_daily_rental_price=spec["reserved_daily_rental_price"],
                        notes=spec["notes"],
                        created_by=actor_id,
                        updated_by=actor_id,
                    )
                )

        reservation = await self.get(reservation.id)
        await self.audit.record_update(
            module="reservations",
            entity_type="Reservation",
            entity_id=reservation.id,
            old_values=old_values,
            new_values=_snapshot(reservation, await self._load_live_items(reservation.id)),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="تم تحديث حجز مسودة",
        )
        return reservation

    async def confirm(
        self,
        reservation_id: UUID,
        *,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Reservation:
        """Confirm draft: calendar RESERVATION blocks + AVAILABLE→RESERVED."""
        reservation = await self.get(reservation_id)
        if reservation.status != ReservationStatus.DRAFT.value:
            raise ValidationError(
                "يمكن تأكيد الحجوزات المسودة فقط",
                details={"status": reservation.status},
            )
        live_items = await self._load_live_items(reservation.id)
        if not live_items:
            raise ValidationError("يجب أن يحتوي الحجز على فستان واحد على الأقل")

        await self._require_customer(reservation.customer_id)
        start = ensure_utc(reservation.rental_start_at)
        end = ensure_utc(reservation.expected_return_at)
        _validate_dates(ensure_utc(reservation.reservation_at), start, end)

        for item in live_items:
            await self._require_dress(item.dress_id)
            available = await self.calendar.is_available(item.dress_id, start, end)
            if not available:
                conflicts = await self.calendar.get_conflicts(item.dress_id, start, end)
                raise ConflictError(
                    "الفستان غير متاح في الفترة المطلوبة",
                    details={
                        "dress_id": str(item.dress_id),
                        "conflicts": [c.as_dict() for c in conflicts],
                    },
                )

        old_values = _snapshot(reservation, live_items)

        for item in live_items:
            block = await self.calendar.create_block(
                dress_id=item.dress_id,
                block_type=CalendarBlockType.RESERVATION,
                start_at=start,
                end_at=end,
                reference_module="reservation",
                reference_id=reservation.id,
                notes=f"حجز {reservation.reservation_number}",
                actor_id=actor_id,
                actor_username=actor_username,
                ip_address=ip_address,
            )
            await self.items.update_fields(
                item,
                calendar_block_id=block.id,
                updated_by=actor_id,
                updated_at=utc_now(),
            )
            await self.dress_status.change_status(
                item.dress_id,
                DressStatus.RESERVED,
                reason=f"تأكيد الحجز {reservation.reservation_number}",
                actor_id=actor_id,
                actor_username=actor_username,
                ip_address=ip_address,
            )

        reservation = await self.reservations.update_fields(
            reservation,
            status=ReservationStatus.CONFIRMED.value,
            updated_by=actor_id,
            updated_at=utc_now(),
        )
        reservation = await self.get(reservation.id)
        await self.audit.record(
            module="reservations",
            entity_type="Reservation",
            entity_id=reservation.id,
            action=AuditAction.CONFIRM,
            old_values=old_values,
            new_values=_snapshot(reservation, await self._load_live_items(reservation.id)),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="تم تأكيد الحجز",
        )
        return reservation

    async def _release_confirmed(
        self,
        reservation: Reservation,
        *,
        actor_id: UUID | None,
        actor_username: str | None,
        ip_address: str | None,
    ) -> None:
        for item in await self._load_live_items(reservation.id):
            if item.calendar_block_id is not None:
                try:
                    await self.calendar.remove_block(
                        item.calendar_block_id,
                        actor_id=actor_id,
                        actor_username=actor_username,
                        ip_address=ip_address,
                    )
                except NotFoundError:
                    pass
                await self.items.update_fields(
                    item,
                    calendar_block_id=None,
                    updated_by=actor_id,
                    updated_at=utc_now(),
                )
            current = await self.dress_status.get_current_status(item.dress_id)
            if current == DressStatus.RESERVED.value:
                await self.dress_status.change_status(
                    item.dress_id,
                    DressStatus.AVAILABLE,
                    reason=f"تحرير الحجز {reservation.reservation_number}",
                    actor_id=actor_id,
                    actor_username=actor_username,
                    ip_address=ip_address,
                )

    async def cancel(
        self,
        reservation_id: UUID,
        *,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Reservation:
        """Cancel Draft or Confirmed reservation."""
        reservation = await self.get(reservation_id)
        if reservation.status not in {
            ReservationStatus.DRAFT.value,
            ReservationStatus.CONFIRMED.value,
        }:
            raise ValidationError(
                "لا يمكن إلغاء هذا الحجز في حالته الحالية",
                details={"status": reservation.status},
            )
        old_values = _snapshot(reservation, await self._load_live_items(reservation.id))
        if reservation.status == ReservationStatus.CONFIRMED.value:
            await self._release_confirmed(
                reservation,
                actor_id=actor_id,
                actor_username=actor_username,
                ip_address=ip_address,
            )
        reservation = await self.reservations.update_fields(
            reservation,
            status=ReservationStatus.CANCELLED.value,
            updated_by=actor_id,
            updated_at=utc_now(),
        )
        reservation = await self.get(reservation.id)
        await self.audit.record(
            module="reservations",
            entity_type="Reservation",
            entity_id=reservation.id,
            action=AuditAction.CANCEL,
            old_values=old_values,
            new_values=_snapshot(reservation, await self._load_live_items(reservation.id)),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="تم إلغاء الحجز",
        )
        return reservation

    async def expire(
        self,
        reservation_id: UUID,
        *,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Reservation:
        """Expire a Confirmed reservation and release calendar/status."""
        reservation = await self.get(reservation_id)
        if reservation.status != ReservationStatus.CONFIRMED.value:
            raise ValidationError(
                "يمكن إنهاء صلاحية الحجوزات المؤكدة فقط",
                details={"status": reservation.status},
            )
        old_values = _snapshot(reservation, await self._load_live_items(reservation.id))
        await self._release_confirmed(
            reservation,
            actor_id=actor_id,
            actor_username=actor_username,
            ip_address=ip_address,
        )
        reservation = await self.reservations.update_fields(
            reservation,
            status=ReservationStatus.EXPIRED.value,
            updated_by=actor_id,
            updated_at=utc_now(),
        )
        reservation = await self.get(reservation.id)
        await self.audit.record(
            module="reservations",
            entity_type="Reservation",
            entity_id=reservation.id,
            action=AuditAction.EXPIRE,
            old_values=old_values,
            new_values=_snapshot(reservation, await self._load_live_items(reservation.id)),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="انتهت صلاحية الحجز",
        )
        return reservation

    async def mark_converted_to_rental(
        self,
        reservation_id: UUID,
        *,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Reservation:
        """Mark a Confirmed reservation as converted (called by Rentals after handover)."""
        reservation = await self.get(reservation_id)
        if reservation.status != ReservationStatus.CONFIRMED.value:
            raise ValidationError(
                "يمكن تحويل الحجوزات المؤكدة فقط إلى إيجار",
                details={"status": reservation.status},
            )
        old_values = _snapshot(reservation, await self._load_live_items(reservation.id))
        for item in await self._load_live_items(reservation.id):
            if item.calendar_block_id is not None:
                await self.items.update_fields(
                    item,
                    calendar_block_id=None,
                    updated_by=actor_id,
                    updated_at=utc_now(),
                )
        reservation = await self.reservations.update_fields(
            reservation,
            status=ReservationStatus.CONVERTED_TO_RENTAL.value,
            updated_by=actor_id,
            updated_at=utc_now(),
        )
        reservation = await self.get(reservation.id)
        await self.audit.record(
            module="reservations",
            entity_type="Reservation",
            entity_id=reservation.id,
            action=AuditAction.CONVERT,
            old_values=old_values,
            new_values=_snapshot(reservation, await self._load_live_items(reservation.id)),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            message="تم تحويل الحجز إلى إيجار",
        )
        return reservation

    async def convert_to_rental(self, reservation_id: UUID) -> None:
        """Use POST /rentals with reservation_id instead of this method."""
        await self.get(reservation_id)
        raise ValidationError(
            "حوّل الحجز عبر إنشاء إيجار مرتبط به — POST /api/v1/rentals",
            details={"code": "use_rentals_create"},
        )
