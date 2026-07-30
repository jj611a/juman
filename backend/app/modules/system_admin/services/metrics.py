"""Read-only system metrics for administrators."""

from __future__ import annotations

from datetime import datetime

from fastapi import Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.modules.settings.services.setting import SettingService
from app.modules.audit.models import AuditLog
from app.modules.customers.models import Customer
from app.modules.identity.models import User
from app.modules.inventory.models import Dress
from app.modules.rentals.constants import RentalStatus
from app.modules.rentals.models import Rental
from app.modules.reservations.models import Reservation
from app.modules.sales.models import Sale
from app.modules.system_admin.constants import BackupStatus
from app.modules.system_admin.models.backup import SystemBackup
from app.modules.system_admin.schemas.metrics import SystemMetricsResponse
from app.modules.system_admin.services.system_info import SystemInfoService
from app.services.base import BaseService
from app.utils.datetime import ensure_utc, utc_now


class MetricsService(BaseService):
    """Aggregate safe operational counters."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        system_info_service: SystemInfoService | None = None,
    ) -> None:
        super().__init__(session)
        self.system_info = system_info_service or SystemInfoService(
            session, settings_service=SettingService(session)
        )

    async def get_metrics(self, request: Request | None = None) -> SystemMetricsResponse:
        settings = get_settings()
        now = utc_now()
        uptime: float | None = None
        if request is not None:
            raw = getattr(request.app.state, "started_at", None)
            if isinstance(raw, datetime):
                uptime = max(0.0, (now - ensure_utc(raw)).total_seconds())

        async def _count(model) -> int:  # noqa: ANN001
            stmt = (
                select(func.count())
                .select_from(model)
                .where(model.is_deleted.is_(False))
            )
            return int((await self.session.execute(stmt)).scalar_one())

        users = await _count(User)
        dresses = await _count(Dress)
        customers = await _count(Customer)
        reservations = await _count(Reservation)
        sales = await _count(Sale)
        audit_logs = int(
            (await self.session.execute(select(func.count()).select_from(AuditLog))).scalar_one()
        )

        active_rentals = int(
            (
                await self.session.execute(
                    select(func.count())
                    .select_from(Rental)
                    .where(
                        Rental.is_deleted.is_(False),
                        Rental.status == RentalStatus.ACTIVE.value,
                    )
                )
            ).scalar_one()
        )

        backups = int(
            (
                await self.session.execute(
                    select(func.count())
                    .select_from(SystemBackup)
                    .where(
                        SystemBackup.is_deleted.is_(False),
                        SystemBackup.status == BackupStatus.COMPLETED.value,
                    )
                )
            ).scalar_one()
        )
        last_backup_at = (
            await self.session.execute(
                select(SystemBackup.created_at)
                .where(
                    SystemBackup.is_deleted.is_(False),
                    SystemBackup.status == BackupStatus.COMPLETED.value,
                )
                .order_by(SystemBackup.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

        info = await self.system_info.get_info(request)
        return SystemMetricsResponse(
            users=users,
            dresses=dresses,
            customers=customers,
            active_rentals=active_rentals,
            reservations=reservations,
            sales=sales,
            audit_logs=audit_logs,
            backups=backups,
            last_backup_at=last_backup_at,
            database_size_bytes=info.database_size_bytes,
            uptime_seconds=uptime if uptime is not None else info.uptime_seconds,
            environment=settings.app_env.value,
            collected_at=now,
        )
