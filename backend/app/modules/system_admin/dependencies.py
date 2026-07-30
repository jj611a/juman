"""System Administration FastAPI dependencies."""

from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db
from app.modules.audit.services.audit_log import AuditService
from app.modules.settings.services.setting import SettingService
from app.modules.system_admin.services.backup import BackupService
from app.modules.system_admin.services.diagnostics import DiagnosticsService
from app.modules.system_admin.services.maintenance import MaintenanceService
from app.modules.system_admin.services.metrics import MetricsService
from app.modules.system_admin.services.restore import RestoreService
from app.modules.system_admin.services.system_info import SystemInfoService


async def get_system_info_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AsyncGenerator[SystemInfoService]:
    yield SystemInfoService(session, settings_service=SettingService(session))


async def get_diagnostics_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AsyncGenerator[DiagnosticsService]:
    yield DiagnosticsService(session, settings_service=SettingService(session))


async def get_maintenance_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AsyncGenerator[MaintenanceService]:
    yield MaintenanceService(
        session,
        settings_service=SettingService(session),
        audit_service=AuditService(session),
    )


async def get_metrics_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AsyncGenerator[MetricsService]:
    yield MetricsService(
        session,
        system_info_service=SystemInfoService(session, settings_service=SettingService(session)),
    )


async def get_backup_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AsyncGenerator[BackupService]:
    yield BackupService(
        session,
        settings_service=SettingService(session),
        audit_service=AuditService(session),
    )


async def get_restore_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AsyncGenerator[RestoreService]:
    settings = SettingService(session)
    audit = AuditService(session)
    backup = BackupService(session, settings_service=settings, audit_service=audit)
    yield RestoreService(
        session,
        settings_service=settings,
        audit_service=audit,
        backup_service=backup,
    )
