"""Report query repository — SQL aggregates over domain tables."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.customers.models import Customer
from app.modules.inspection.constants import DressCondition, InspectionStatus
from app.modules.inspection.models import Inspection, InspectionItem
from app.modules.inventory.constants import DressStatus
from app.modules.inventory.models import Dress
from app.modules.processing.constants import ProcessingStatus
from app.modules.processing.models import ProcessingBatch
from app.modules.rentals.constants import RentalStatus
from app.modules.rentals.models import Rental, RentalItem
from app.modules.reservations.constants import ReservationStatus
from app.modules.reservations.models import Reservation
from app.modules.reports.constants import NULL_BRAND_KEY
from app.modules.returns.models import Return
from app.modules.sales.constants import SaleOrigin, SaleStatus
from app.modules.sales.models import Sale, SaleItem, SalePayment
from app.modules.settlements.constants import SettlementStatus
from app.modules.settlements.models import RentalSettlement, RentalSettlementPayment
from app.modules.categories.models import Category
from app.utils.datetime import ensure_utc


_REPORTABLE_DRESS_STATUSES = (
    DressStatus.AVAILABLE.value,
    DressStatus.RESERVED.value,
    DressStatus.RENTED.value,
    DressStatus.INSPECTION.value,
    DressStatus.PROCESSING.value,
    DressStatus.SOLD.value,
    DressStatus.RUINED.value,
    DressStatus.RUINED_PENDING_SALE.value,
)


class ReportQueryRepository:
    """Read-only aggregates. Does not mutate domain state."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def dress_status_counts(self) -> dict[str, int]:
        stmt = (
            select(Dress.status, func.count())
            .where(Dress.is_deleted.is_(False))
            .group_by(Dress.status)
        )
        rows = (await self.session.execute(stmt)).all()
        counts = {s: 0 for s in _REPORTABLE_DRESS_STATUSES}
        for status, count in rows:
            if status in counts:
                counts[status] = int(count)
        return counts

    async def dresses_total(self, *, active_only: bool = False) -> int:
        stmt = select(func.count()).select_from(Dress).where(Dress.is_deleted.is_(False))
        if active_only:
            stmt = stmt.where(Dress.is_active.is_(True))
        return int((await self.session.execute(stmt)).scalar_one())

    async def count_by_dress_attr(self, column) -> list[tuple[str, int]]:
        labeled = func.coalesce(column, NULL_BRAND_KEY).label("k")
        stmt = (
            select(labeled, func.count())
            .select_from(Dress)
            .where(Dress.is_deleted.is_(False))
            .group_by(labeled)
            .order_by(func.count().desc())
        )
        return [(str(k), int(c)) for k, c in (await self.session.execute(stmt)).all()]

    async def count_by_category(self) -> list[tuple[str, int]]:
        stmt = (
            select(Category.name_ar, func.count())
            .select_from(Dress)
            .join(Category, Category.id == Dress.category_id)
            .where(Dress.is_deleted.is_(False), Category.is_deleted.is_(False))
            .group_by(Category.name_ar)
            .order_by(func.count().desc())
        )
        return [(str(k), int(c)) for k, c in (await self.session.execute(stmt)).all()]

    def _never_rented_filter(self):
        rented = (
            select(RentalItem.dress_id)
            .join(Rental, Rental.id == RentalItem.rental_id)
            .where(
                RentalItem.is_deleted.is_(False),
                Rental.is_deleted.is_(False),
                Rental.status.notin_([RentalStatus.CANCELLED.value, RentalStatus.DRAFT.value]),
            )
            .distinct()
        )
        return and_(Dress.is_deleted.is_(False), Dress.id.notin_(rented))

    async def never_rented_count(self) -> int:
        stmt = select(func.count()).select_from(Dress).where(self._never_rented_filter())
        return int((await self.session.execute(stmt)).scalar_one())

    async def never_rented_list(
        self, *, offset: int, limit: int, sort_by: str, sort_dir: str
    ) -> tuple[list[Dress], int]:
        total = await self.never_rented_count()
        col = getattr(Dress, sort_by)
        order = col.asc() if sort_dir == "asc" else col.desc()
        stmt = (
            select(Dress)
            .where(self._never_rented_filter())
            .order_by(order)
            .offset(offset)
            .limit(limit)
        )
        items = list((await self.session.execute(stmt)).scalars().all())
        return items, total

    async def rental_count(
        self, *, status: str | None = None, due_from=None, due_to=None, overdue_before=None
    ) -> int:
        stmt = select(func.count()).select_from(Rental).where(Rental.is_deleted.is_(False))
        if status:
            stmt = stmt.where(Rental.status == status)
        if due_from is not None and due_to is not None:
            stmt = stmt.where(
                Rental.status == RentalStatus.ACTIVE.value,
                Rental.expected_return_at >= due_from,
                Rental.expected_return_at < due_to,
            )
        if overdue_before is not None:
            stmt = stmt.where(
                Rental.status == RentalStatus.ACTIVE.value,
                Rental.expected_return_at < overdue_before,
            )
        return int((await self.session.execute(stmt)).scalar_one())

    async def rentals_created_by_status(self, start: datetime, end: datetime) -> dict[str, int]:
        stmt = (
            select(Rental.status, func.count())
            .where(
                Rental.is_deleted.is_(False),
                Rental.rental_at >= start,
                Rental.rental_at < end,
            )
            .group_by(Rental.status)
        )
        return {str(s): int(c) for s, c in (await self.session.execute(stmt)).all()}

    async def completed_settled_rentals(self, start: datetime, end: datetime) -> int:
        stmt = (
            select(func.count())
            .select_from(RentalSettlement)
            .where(
                RentalSettlement.is_deleted.is_(False),
                RentalSettlement.status == SettlementStatus.PAID.value,
                RentalSettlement.settled_at.is_not(None),
                RentalSettlement.settled_at >= start,
                RentalSettlement.settled_at < end,
            )
        )
        return int((await self.session.execute(stmt)).scalar_one())

    async def most_rented_dresses(self, *, limit: int = 10) -> list[dict]:
        stmt = (
            select(
                RentalItem.dress_id,
                Dress.barcode,
                Dress.name_ar,
                func.count().label("rental_count"),
            )
            .join(Rental, Rental.id == RentalItem.rental_id)
            .join(Dress, Dress.id == RentalItem.dress_id)
            .where(
                RentalItem.is_deleted.is_(False),
                Rental.is_deleted.is_(False),
                Dress.is_deleted.is_(False),
                Rental.status.notin_([RentalStatus.CANCELLED.value, RentalStatus.DRAFT.value]),
            )
            .group_by(RentalItem.dress_id, Dress.barcode, Dress.name_ar)
            .order_by(func.count().desc())
            .limit(limit)
        )
        return [
            {
                "dress_id": str(dress_id),
                "barcode": barcode,
                "name_ar": name_ar,
                "rental_count": int(count),
            }
            for dress_id, barcode, name_ar, count in (await self.session.execute(stmt)).all()
        ]

    async def rentals_details(
        self,
        *,
        start: datetime,
        end: datetime,
        status: str | None,
        offset: int,
        limit: int,
        sort_by: str,
        sort_dir: str,
    ) -> tuple[list[dict], int]:
        filters = [
            Rental.is_deleted.is_(False),
            Rental.rental_at >= start,
            Rental.rental_at < end,
        ]
        if status:
            filters.append(Rental.status == status)
        count_stmt = select(func.count()).select_from(Rental).where(*filters)
        total = int((await self.session.execute(count_stmt)).scalar_one())
        col = getattr(Rental, sort_by)
        order = col.asc() if sort_dir == "asc" else col.desc()
        stmt = (
            select(Rental, Return.returned_at)
            .outerjoin(
                Return,
                and_(Return.rental_id == Rental.id, Return.is_deleted.is_(False)),
            )
            .where(*filters)
            .order_by(order)
            .offset(offset)
            .limit(limit)
        )
        rows = (await self.session.execute(stmt)).all()
        items: list[dict] = []
        for rental, returned_at in rows:
            duration_seconds = None
            if returned_at is not None:
                duration_seconds = int(
                    (ensure_utc(returned_at) - ensure_utc(rental.rental_at)).total_seconds()
                )
            items.append(
                {
                    "id": rental.id,
                    "rental_number": rental.rental_number,
                    "customer_id": rental.customer_id,
                    "status": rental.status,
                    "rental_at": rental.rental_at,
                    "expected_return_at": rental.expected_return_at,
                    "estimated_total": rental.estimated_total,
                    "duration_seconds": duration_seconds,
                }
            )
        return items, total

    async def reservations_created_by_status(self, start: datetime, end: datetime) -> dict[str, int]:
        stmt = (
            select(Reservation.status, func.count())
            .where(
                Reservation.is_deleted.is_(False),
                Reservation.created_at >= start,
                Reservation.created_at < end,
            )
            .group_by(Reservation.status)
        )
        return {str(s): int(c) for s, c in (await self.session.execute(stmt)).all()}

    async def reservations_today(self, start: datetime, end: datetime) -> int:
        stmt = select(func.count()).select_from(Reservation).where(
            Reservation.is_deleted.is_(False),
            Reservation.status == ReservationStatus.CONFIRMED.value,
            Reservation.rental_start_at >= start,
            Reservation.rental_start_at < end,
        )
        return int((await self.session.execute(stmt)).scalar_one())

    async def reservations_upcoming(self, after: datetime) -> int:
        stmt = select(func.count()).select_from(Reservation).where(
            Reservation.is_deleted.is_(False),
            Reservation.status == ReservationStatus.CONFIRMED.value,
            Reservation.rental_start_at >= after,
        )
        return int((await self.session.execute(stmt)).scalar_one())

    async def reservations_by_customer(self, start: datetime, end: datetime, *, limit: int = 10):
        stmt = (
            select(
                Reservation.customer_id,
                Customer.customer_number,
                Customer.full_name,
                func.count().label("cnt"),
            )
            .join(Customer, Customer.id == Reservation.customer_id)
            .where(
                Reservation.is_deleted.is_(False),
                Customer.is_deleted.is_(False),
                Reservation.created_at >= start,
                Reservation.created_at < end,
            )
            .group_by(Reservation.customer_id, Customer.customer_number, Customer.full_name)
            .order_by(func.count().desc())
            .limit(limit)
        )
        return [
            {
                "customer_id": str(cid),
                "customer_number": num,
                "full_name": name,
                "count": int(c),
            }
            for cid, num, name, c in (await self.session.execute(stmt)).all()
        ]

    async def reservations_by_cashier(self, start: datetime, end: datetime, *, limit: int = 10):
        stmt = (
            select(Reservation.created_by, func.count())
            .where(
                Reservation.is_deleted.is_(False),
                Reservation.created_at >= start,
                Reservation.created_at < end,
                Reservation.created_by.is_not(None),
            )
            .group_by(Reservation.created_by)
            .order_by(func.count().desc())
            .limit(limit)
        )
        return [
            {"cashier_id": str(cid), "count": int(c)}
            for cid, c in (await self.session.execute(stmt)).all()
        ]

    async def customers_total(self) -> int:
        stmt = select(func.count()).select_from(Customer).where(Customer.is_deleted.is_(False))
        return int((await self.session.execute(stmt)).scalar_one())

    async def customers_new(self, start: datetime, end: datetime) -> int:
        stmt = select(func.count()).select_from(Customer).where(
            Customer.is_deleted.is_(False),
            Customer.created_at >= start,
            Customer.created_at < end,
        )
        return int((await self.session.execute(stmt)).scalar_one())

    async def customers_with_rental_status(self, status: str, *, overdue_before=None) -> int:
        filters = [
            Customer.is_deleted.is_(False),
            Rental.is_deleted.is_(False),
            Rental.status == status,
        ]
        if overdue_before is not None:
            filters.append(Rental.expected_return_at < overdue_before)
        stmt = (
            select(func.count(func.distinct(Customer.id)))
            .select_from(Customer)
            .join(Rental, Rental.customer_id == Customer.id)
            .where(*filters)
        )
        return int((await self.session.execute(stmt)).scalar_one())

    async def top_customers_rental_count(self, *, limit: int = 10) -> list[dict]:
        stmt = (
            select(
                Customer.id,
                Customer.customer_number,
                Customer.full_name,
                func.count(Rental.id).label("value"),
            )
            .join(Rental, Rental.customer_id == Customer.id)
            .where(
                Customer.is_deleted.is_(False),
                Rental.is_deleted.is_(False),
                Rental.status.notin_([RentalStatus.CANCELLED.value, RentalStatus.DRAFT.value]),
            )
            .group_by(Customer.id, Customer.customer_number, Customer.full_name)
            .order_by(func.count(Rental.id).desc())
            .limit(limit)
        )
        return [
            {
                "id": cid,
                "customer_number": num,
                "full_name": name,
                "metric": "rental_count",
                "value": int(v),
            }
            for cid, num, name, v in (await self.session.execute(stmt)).all()
        ]

    async def top_customers_rental_gross(self, *, limit: int = 10) -> list[dict]:
        stmt = (
            select(
                Customer.id,
                Customer.customer_number,
                Customer.full_name,
                func.coalesce(func.sum(RentalSettlement.gross_total), 0).label("value"),
            )
            .join(Rental, Rental.customer_id == Customer.id)
            .join(RentalSettlement, RentalSettlement.rental_id == Rental.id)
            .where(
                Customer.is_deleted.is_(False),
                Rental.is_deleted.is_(False),
                RentalSettlement.is_deleted.is_(False),
                RentalSettlement.status != SettlementStatus.VOIDED.value,
            )
            .group_by(Customer.id, Customer.customer_number, Customer.full_name)
            .order_by(func.coalesce(func.sum(RentalSettlement.gross_total), 0).desc())
            .limit(limit)
        )
        return [
            {
                "id": cid,
                "customer_number": num,
                "full_name": name,
                "metric": "rental_gross",
                "value": int(v),
            }
            for cid, num, name, v in (await self.session.execute(stmt)).all()
        ]

    async def top_customers_sale_value(self, *, limit: int = 10) -> list[dict]:
        stmt = (
            select(
                Customer.id,
                Customer.customer_number,
                Customer.full_name,
                func.coalesce(func.sum(Sale.total_amount), 0).label("value"),
            )
            .join(Sale, Sale.customer_id == Customer.id)
            .where(
                Customer.is_deleted.is_(False),
                Sale.is_deleted.is_(False),
                Sale.status == SaleStatus.COMPLETED.value,
            )
            .group_by(Customer.id, Customer.customer_number, Customer.full_name)
            .order_by(func.coalesce(func.sum(Sale.total_amount), 0).desc())
            .limit(limit)
        )
        return [
            {
                "id": cid,
                "customer_number": num,
                "full_name": name,
                "metric": "sale_value",
                "value": int(v),
            }
            for cid, num, name, v in (await self.session.execute(stmt)).all()
        ]

    async def inspections_summary(self, start: datetime, end: datetime) -> dict:
        insp_count = int(
            (
                await self.session.execute(
                    select(func.count()).select_from(Inspection).where(
                        Inspection.is_deleted.is_(False),
                        Inspection.status == InspectionStatus.COMPLETED.value,
                        Inspection.inspected_at.is_not(None),
                        Inspection.inspected_at >= start,
                        Inspection.inspected_at < end,
                    )
                )
            ).scalar_one()
        )
        cond_stmt = (
            select(InspectionItem.condition, func.count())
            .join(Inspection, Inspection.id == InspectionItem.inspection_id)
            .where(
                InspectionItem.is_deleted.is_(False),
                Inspection.is_deleted.is_(False),
                Inspection.status == InspectionStatus.COMPLETED.value,
                Inspection.inspected_at.is_not(None),
                Inspection.inspected_at >= start,
                Inspection.inspected_at < end,
            )
            .group_by(InspectionItem.condition)
        )
        by_cond = {str(c): int(n) for c, n in (await self.session.execute(cond_stmt)).all()}
        penalty = int(
            (
                await self.session.execute(
                    select(func.coalesce(func.sum(InspectionItem.repair_penalty_amount), 0))
                    .join(Inspection, Inspection.id == InspectionItem.inspection_id)
                    .where(
                        InspectionItem.is_deleted.is_(False),
                        Inspection.is_deleted.is_(False),
                        Inspection.status == InspectionStatus.COMPLETED.value,
                        InspectionItem.condition == DressCondition.MINOR_DAMAGE.value,
                        Inspection.inspected_at.is_not(None),
                        Inspection.inspected_at >= start,
                        Inspection.inspected_at < end,
                    )
                )
            ).scalar_one()
        )
        damage_filters = [
            InspectionItem.is_deleted.is_(False),
            Inspection.is_deleted.is_(False),
            Inspection.status == InspectionStatus.COMPLETED.value,
            InspectionItem.condition.in_(
                [DressCondition.MINOR_DAMAGE.value, DressCondition.MAJOR_DAMAGE.value]
            ),
            Inspection.inspected_at.is_not(None),
            Inspection.inspected_at >= start,
            Inspection.inspected_at < end,
        ]
        by_dress_stmt = (
            select(InspectionItem.dress_id, func.count())
            .join(Inspection, Inspection.id == InspectionItem.inspection_id)
            .where(*damage_filters)
            .group_by(InspectionItem.dress_id)
            .order_by(func.count().desc())
            .limit(10)
        )
        by_dress = [
            {"dress_id": str(d), "count": int(c)}
            for d, c in (await self.session.execute(by_dress_stmt)).all()
        ]
        by_cust_stmt = (
            select(Return.customer_id, func.count())
            .select_from(InspectionItem)
            .join(Inspection, Inspection.id == InspectionItem.inspection_id)
            .join(Return, Return.id == Inspection.return_id)
            .where(
                *damage_filters,
                Return.is_deleted.is_(False),
                Return.customer_id.is_not(None),
            )
            .group_by(Return.customer_id)
            .order_by(func.count().desc())
            .limit(10)
        )
        by_customer = [
            {"customer_id": str(c), "count": int(n)}
            for c, n in (await self.session.execute(by_cust_stmt)).all()
        ]
        repeated_stmt = (
            select(InspectionItem.dress_id, func.count())
            .join(Inspection, Inspection.id == InspectionItem.inspection_id)
            .where(*damage_filters)
            .group_by(InspectionItem.dress_id)
            .having(func.count() >= 2)
            .order_by(func.count().desc())
            .limit(20)
        )
        repeated = [
            {"dress_id": str(d), "count": int(c)}
            for d, c in (await self.session.execute(repeated_stmt)).all()
        ]
        return {
            "inspections_completed": insp_count,
            "items_by_condition": by_cond,
            "minor_repair_penalties_total": penalty,
            "damage_by_dress": by_dress,
            "damage_by_customer": by_customer,
            "repeated_damage_dresses": repeated,
        }

    async def processing_summary(
        self, start: datetime, end: datetime, *, long_running_before: datetime
    ) -> dict:
        in_process = int(
            (
                await self.session.execute(
                    select(func.count()).select_from(ProcessingBatch).where(
                        ProcessingBatch.is_deleted.is_(False),
                        ProcessingBatch.status == ProcessingStatus.IN_PROCESS.value,
                    )
                )
            ).scalar_one()
        )
        dresses_proc = int(
            (
                await self.session.execute(
                    select(func.count()).select_from(Dress).where(
                        Dress.is_deleted.is_(False),
                        Dress.status == DressStatus.PROCESSING.value,
                    )
                )
            ).scalar_one()
        )
        started = int(
            (
                await self.session.execute(
                    select(func.count()).select_from(ProcessingBatch).where(
                        ProcessingBatch.is_deleted.is_(False),
                        ProcessingBatch.started_at.is_not(None),
                        ProcessingBatch.started_at >= start,
                        ProcessingBatch.started_at < end,
                    )
                )
            ).scalar_one()
        )
        completed = int(
            (
                await self.session.execute(
                    select(func.count()).select_from(ProcessingBatch).where(
                        ProcessingBatch.is_deleted.is_(False),
                        ProcessingBatch.completed_at.is_not(None),
                        ProcessingBatch.completed_at >= start,
                        ProcessingBatch.completed_at < end,
                    )
                )
            ).scalar_one()
        )
        optional = int(
            (
                await self.session.execute(
                    select(func.count()).select_from(ProcessingBatch).where(
                        ProcessingBatch.is_deleted.is_(False),
                        ProcessingBatch.optional_extra_day_enabled.is_(True),
                        ProcessingBatch.started_at.is_not(None),
                        ProcessingBatch.started_at >= start,
                        ProcessingBatch.started_at < end,
                    )
                )
            ).scalar_one()
        )
        avg_rows = (
            await self.session.execute(
                select(ProcessingBatch.started_at, ProcessingBatch.completed_at).where(
                    ProcessingBatch.is_deleted.is_(False),
                    ProcessingBatch.started_at.is_not(None),
                    ProcessingBatch.completed_at.is_not(None),
                    ProcessingBatch.completed_at >= start,
                    ProcessingBatch.completed_at < end,
                )
            )
        ).all()
        avg = None
        if avg_rows:
            total = sum((c - s).total_seconds() for s, c in avg_rows)
            avg = total / len(avg_rows)
        long_running = int(
            (
                await self.session.execute(
                    select(func.count()).select_from(ProcessingBatch).where(
                        ProcessingBatch.is_deleted.is_(False),
                        ProcessingBatch.status == ProcessingStatus.IN_PROCESS.value,
                        ProcessingBatch.started_at.is_not(None),
                        ProcessingBatch.started_at < long_running_before,
                    )
                )
            ).scalar_one()
        )
        return {
            "batches_in_process": in_process,
            "dresses_in_processing": dresses_proc,
            "started_in_range": started,
            "completed_in_range": completed,
            "optional_extra_day_count": optional,
            "avg_duration_seconds": avg,
            "long_running_batches": long_running,
        }

    async def sales_summary(self, start: datetime, end: datetime) -> dict:
        base = and_(
            Sale.is_deleted.is_(False),
            Sale.status == SaleStatus.COMPLETED.value,
            Sale.sold_at >= start,
            Sale.sold_at < end,
        )
        count = int(
            (await self.session.execute(select(func.count()).select_from(Sale).where(base))).scalar_one()
        )
        total = int(
            (
                await self.session.execute(
                    select(func.coalesce(func.sum(Sale.total_amount), 0)).where(base)
                )
            ).scalar_one()
        )
        normal = int(
            (
                await self.session.execute(
                    select(func.coalesce(func.sum(Sale.total_amount), 0)).where(
                        base, Sale.origin == SaleOrigin.NORMAL_SALE.value
                    )
                )
            ).scalar_one()
        )
        mandatory = int(
            (
                await self.session.execute(
                    select(func.coalesce(func.sum(Sale.total_amount), 0)).where(
                        base, Sale.origin == SaleOrigin.MANDATORY_DAMAGE_PURCHASE.value
                    )
                )
            ).scalar_one()
        )
        overrides = int(
            (
                await self.session.execute(
                    select(func.count())
                    .select_from(SaleItem)
                    .join(Sale, Sale.id == SaleItem.sale_id)
                    .where(
                        base,
                        SaleItem.actual_sale_price != SaleItem.default_sale_price,
                    )
                )
            ).scalar_one()
        )
        by_cashier = [
            {"cashier_id": str(cid), "count": int(c), "total_amount": int(t)}
            for cid, c, t in (
                await self.session.execute(
                    select(
                        Sale.sold_by,
                        func.count(),
                        func.coalesce(func.sum(Sale.total_amount), 0),
                    )
                    .where(base, Sale.sold_by.is_not(None))
                    .group_by(Sale.sold_by)
                    .order_by(func.coalesce(func.sum(Sale.total_amount), 0).desc())
                    .limit(10)
                )
            ).all()
        ]
        by_category = [
            {"category": name, "count": int(c), "total_amount": int(t)}
            for name, c, t in (
                await self.session.execute(
                    select(
                        Category.name_ar,
                        func.count(SaleItem.id),
                        func.coalesce(func.sum(SaleItem.actual_sale_price), 0),
                    )
                    .select_from(SaleItem)
                    .join(Sale, Sale.id == SaleItem.sale_id)
                    .join(Dress, Dress.id == SaleItem.dress_id)
                    .join(Category, Category.id == Dress.category_id)
                    .where(base)
                    .group_by(Category.name_ar)
                    .order_by(func.coalesce(func.sum(SaleItem.actual_sale_price), 0).desc())
                    .limit(20)
                )
            ).all()
        ]
        avg = (total / count) if count else None
        return {
            "sales_count": count,
            "sale_revenue": total,
            "sale_revenue_normal": normal,
            "sale_revenue_mandatory": mandatory,
            "average_sale_value": avg,
            "override_line_count": overrides,
            "by_cashier": by_cashier,
            "by_category": by_category,
        }

    async def sales_details(
        self,
        *,
        start: datetime,
        end: datetime,
        origin: str | None,
        offset: int,
        limit: int,
        sort_by: str,
        sort_dir: str,
    ) -> tuple[list[Sale], int]:
        filters = [
            Sale.is_deleted.is_(False),
            Sale.status == SaleStatus.COMPLETED.value,
            Sale.sold_at >= start,
            Sale.sold_at < end,
        ]
        if origin:
            filters.append(Sale.origin == origin)
        total = int(
            (await self.session.execute(select(func.count()).select_from(Sale).where(*filters))).scalar_one()
        )
        col = getattr(Sale, sort_by)
        order = col.asc() if sort_dir == "asc" else col.desc()
        items = list(
            (
                await self.session.execute(
                    select(Sale).where(*filters).order_by(order).offset(offset).limit(limit)
                )
            )
            .scalars()
            .all()
        )
        return items, total

    async def financial_summary(self, start: datetime, end: datetime) -> dict:
        settle_base = and_(
            RentalSettlement.is_deleted.is_(False),
            RentalSettlement.status != SettlementStatus.VOIDED.value,
            RentalSettlement.created_at >= start,
            RentalSettlement.created_at < end,
        )
        row = (
            await self.session.execute(
                select(
                    func.coalesce(func.sum(RentalSettlement.gross_total), 0),
                    func.coalesce(func.sum(RentalSettlement.rental_charge_amount), 0),
                    func.coalesce(func.sum(RentalSettlement.late_penalty_amount), 0),
                    func.coalesce(func.sum(RentalSettlement.minor_damage_penalty_amount), 0),
                    func.coalesce(func.sum(RentalSettlement.manual_adjustment_amount), 0),
                    func.coalesce(func.sum(RentalSettlement.initial_payment_credit), 0),
                ).where(settle_base)
            )
        ).one()
        rental_payments = int(
            (
                await self.session.execute(
                    select(func.coalesce(func.sum(RentalSettlementPayment.amount), 0))
                    .select_from(RentalSettlementPayment)
                    .join(
                        RentalSettlement,
                        RentalSettlement.id == RentalSettlementPayment.settlement_id,
                    )
                    .where(
                        RentalSettlement.is_deleted.is_(False),
                        RentalSettlement.status != SettlementStatus.VOIDED.value,
                        RentalSettlementPayment.received_at >= start,
                        RentalSettlementPayment.received_at < end,
                    )
                )
            ).scalar_one()
        )
        outstanding = int(
            (
                await self.session.execute(
                    select(func.coalesce(func.sum(RentalSettlement.remaining_balance), 0)).where(
                        RentalSettlement.is_deleted.is_(False),
                        RentalSettlement.status.in_(
                            [
                                SettlementStatus.OPEN.value,
                                SettlementStatus.PARTIALLY_PAID.value,
                            ]
                        ),
                    )
                )
            ).scalar_one()
        )
        sale_base = and_(
            Sale.is_deleted.is_(False),
            Sale.status == SaleStatus.COMPLETED.value,
            Sale.sold_at >= start,
            Sale.sold_at < end,
        )
        sale_revenue = int(
            (
                await self.session.execute(
                    select(func.coalesce(func.sum(Sale.total_amount), 0)).where(sale_base)
                )
            ).scalar_one()
        )
        sale_normal = int(
            (
                await self.session.execute(
                    select(func.coalesce(func.sum(Sale.total_amount), 0)).where(
                        sale_base, Sale.origin == SaleOrigin.NORMAL_SALE.value
                    )
                )
            ).scalar_one()
        )
        sale_mandatory = int(
            (
                await self.session.execute(
                    select(func.coalesce(func.sum(Sale.total_amount), 0)).where(
                        sale_base, Sale.origin == SaleOrigin.MANDATORY_DAMAGE_PURCHASE.value
                    )
                )
            ).scalar_one()
        )
        sale_payments = int(
            (
                await self.session.execute(
                    select(func.coalesce(func.sum(SalePayment.amount), 0))
                    .select_from(SalePayment)
                    .join(Sale, Sale.id == SalePayment.sale_id)
                    .where(
                        Sale.is_deleted.is_(False),
                        Sale.status == SaleStatus.COMPLETED.value,
                        SalePayment.received_at >= start,
                        SalePayment.received_at < end,
                    )
                )
            ).scalar_one()
        )
        gross, rental_ch, late, damage, adj, credit = (int(x) for x in row)
        return {
            "rental_charges_gross": gross,
            "rental_charges_rental": rental_ch,
            "rental_charges_late": late,
            "rental_charges_minor_damage": damage,
            "rental_adjustments": adj,
            "rental_initial_credits": credit,
            "rental_payments_collected": rental_payments,
            "rental_outstanding": outstanding,
            "sale_revenue": sale_revenue,
            "sale_revenue_normal": sale_normal,
            "sale_revenue_mandatory": sale_mandatory,
            "sale_payments_collected": sale_payments,
            "total_cash_collected": rental_payments + sale_payments,
            "total_charged": gross + sale_revenue,
        }

    async def financial_daily(self, start: datetime, end: datetime, *, tz_name: str) -> list[dict]:
        """Bucket by calendar day in tz_name using UTC instants (approximate via date(created_at) in UTC).

        For v1, day buckets use the business timezone conversion done in the service layer
        by iterating days; this method returns raw event rows for the service to bucket.
        """
        settlements = (
            await self.session.execute(
                select(
                    RentalSettlement.created_at,
                    RentalSettlement.gross_total,
                ).where(
                    RentalSettlement.is_deleted.is_(False),
                    RentalSettlement.status != SettlementStatus.VOIDED.value,
                    RentalSettlement.created_at >= start,
                    RentalSettlement.created_at < end,
                )
            )
        ).all()
        rent_pays = (
            await self.session.execute(
                select(
                    RentalSettlementPayment.received_at,
                    RentalSettlementPayment.amount,
                )
                .select_from(RentalSettlementPayment)
                .join(
                    RentalSettlement,
                    RentalSettlement.id == RentalSettlementPayment.settlement_id,
                )
                .where(
                    RentalSettlement.is_deleted.is_(False),
                    RentalSettlement.status != SettlementStatus.VOIDED.value,
                    RentalSettlementPayment.received_at >= start,
                    RentalSettlementPayment.received_at < end,
                )
            )
        ).all()
        sales = (
            await self.session.execute(
                select(Sale.sold_at, Sale.total_amount).where(
                    Sale.is_deleted.is_(False),
                    Sale.status == SaleStatus.COMPLETED.value,
                    Sale.sold_at >= start,
                    Sale.sold_at < end,
                )
            )
        ).all()
        sale_pays = (
            await self.session.execute(
                select(SalePayment.received_at, SalePayment.amount)
                .select_from(SalePayment)
                .join(Sale, Sale.id == SalePayment.sale_id)
                .where(
                    Sale.is_deleted.is_(False),
                    Sale.status == SaleStatus.COMPLETED.value,
                    SalePayment.received_at >= start,
                    SalePayment.received_at < end,
                )
            )
        ).all()
        return {
            "settlements": settlements,
            "rental_payments": rent_pays,
            "sales": sales,
            "sale_payments": sale_pays,
        }
