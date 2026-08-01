"""Maintenance task listing, execution, and history."""

from __future__ import annotations

import asyncio
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.settings.services.setting import SettingService
from app.modules.system_admin.constants import (
    MaintenanceRunStatus,
    MaintenanceTaskCategory,
)
from app.modules.system_admin.models.maintenance_run import SystemMaintenanceRun
from app.modules.system_admin.repositories.backup import SystemBackupRepository
from app.modules.system_admin.repositories.maintenance_run import SystemMaintenanceRunRepository
from app.modules.system_admin.repositories.restore import SystemRestoreRepository
from app.modules.system_admin.maintenance.registry import (
    MaintenanceRegistry,
    build_default_registry,
)
from app.modules.system_admin.schemas.system import (
    MaintenanceTaskInfo,
    MaintenanceTasksResponse,
)
from app.services.base import BaseService
from app.utils.datetime import utc_now

_MAINTENANCE_LOCK = asyncio.Lock()
_MAINTENANCE_BUSY = False


class MaintenanceService(BaseService):
    """List and execute maintenance tasks with history."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        registry: MaintenanceRegistry | None = None,
        settings_service: SettingService | None = None,
        audit_service: AuditService | None = None,
        run_repository: SystemMaintenanceRunRepository | None = None,
        backup_repository: SystemBackupRepository | None = None,
        restore_repository: SystemRestoreRepository | None = None,
    ) -> None:
        super().__init__(session)
        self.settings_service = settings_service or SettingService(session)
        self.audit = audit_service or AuditService(session)
        self.runs = run_repository or SystemMaintenanceRunRepository(session)
        self.backups = backup_repository or SystemBackupRepository(session)
        self.restores = restore_repository or SystemRestoreRepository(session)
        self.registry = registry or build_default_registry(
            session, settings_service=self.settings_service
        )

    def list_tasks(self) -> MaintenanceTasksResponse:
        items = [
            MaintenanceTaskInfo(
                id=task.id,
                title=task.title,
                description=task.description,
                phase=task.phase,
                category=task.category,
                requires_confirmation=task.requires_confirmation,
            )
            for task in self.registry.list_tasks()
        ]
        return MaintenanceTasksResponse(items=items)

    async def execute(
        self,
        task_key: str,
        *,
        confirm: bool = False,
        dry_run: bool = False,
        actor_id: UUID | None = None,
        username: str | None = None,
        ip_address: str | None = None,
    ) -> SystemMaintenanceRun:
        task = self.registry.get(task_key)
        if task is None:
            raise NotFoundError("مهمة الصيانة غير موجودة")
        if task.category == MaintenanceTaskCategory.CLEANUP.value and not dry_run and not confirm:
            raise ValidationError("يجب تأكيد تنفيذ مهمة التنظيف")

        global _MAINTENANCE_BUSY
        async with _MAINTENANCE_LOCK:
            if _MAINTENANCE_BUSY or await self.runs.has_running():
                raise ConflictError("مهمة صيانة قيد التنفيذ")
            if await self.backups.has_running():
                raise ConflictError("نسخة احتياطية قيد التنفيذ")
            if await self.restores.has_running():
                raise ConflictError("استعادة قيد التنفيذ")
            _MAINTENANCE_BUSY = True

        started = utc_now()
        run = SystemMaintenanceRun(
            id=uuid4(),
            task_key=task.id,
            task_title=task.title,
            category=task.category,
            status=MaintenanceRunStatus.RUNNING.value,
            dry_run=dry_run,
            started_at=started,
            executed_by_user_id=actor_id,
            created_by=actor_id,
        )
        await self.runs.add(run)
        await self.session.commit()

        await self.audit.record(
            module="system_admin",
            entity_type="system_maintenance_run",
            entity_id=run.id,
            action=AuditAction.CUSTOM,
            user_id=actor_id,
            username=username,
            ip_address=ip_address,
            metadata={
                "maintenance_outcome": "started",
                "task_key": task.id,
                "execution_id": str(run.id),
                "dry_run": dry_run,
            },
            message="بدء مهمة الصيانة",
        )
        await self.session.commit()

        try:
            result = await (task.dry_run() if dry_run else task.execute())
            if not result.success:
                raise RuntimeError(result.message)
            finished = utc_now()
            run.status = MaintenanceRunStatus.COMPLETED.value
            run.finished_at = finished
            run.duration_ms = int((finished - started).total_seconds() * 1000)
            run.summary = result.message
            run.result_details = {
                "objects_checked": result.objects_checked,
                "objects_modified": result.objects_modified,
                "warnings": result.warnings,
                **result.details,
            }
            await self.session.flush()
            outcome = "dry_run" if dry_run else "success"
            audit = await self.audit.record(
                module="system_admin",
                entity_type="system_maintenance_run",
                entity_id=run.id,
                action=AuditAction.CUSTOM,
                user_id=actor_id,
                username=username,
                ip_address=ip_address,
                metadata={
                    "maintenance_outcome": outcome,
                    "task_key": task.id,
                    "execution_id": str(run.id),
                    "summary": result.message[:500],
                },
                message="تم تنفيذ مهمة الصيانة" if not dry_run else "تم معاينة مهمة الصيانة",
            )
            run.audit_log_id = audit.id
            await self.session.commit()
            await self.session.refresh(run)
            return run
        except Exception as exc:  # noqa: BLE001
            await self.session.rollback()
            # reload run after rollback
            run = await self.runs.get_by_id(run.id, include_deleted=True)
            if run is None:
                raise
            finished = utc_now()
            message = str(exc) if str(exc) else "فشل تنفيذ مهمة الصيانة"
            run.status = MaintenanceRunStatus.FAILED.value
            run.finished_at = finished
            run.duration_ms = int((finished - started).total_seconds() * 1000)
            run.error_message = message[:2000]
            run.summary = message[:2000]
            await self.session.flush()
            audit = await self.audit.record(
                module="system_admin",
                entity_type="system_maintenance_run",
                entity_id=run.id,
                action=AuditAction.CUSTOM,
                user_id=actor_id,
                username=username,
                ip_address=ip_address,
                metadata={
                    "maintenance_outcome": "failure",
                    "task_key": task_key,
                    "execution_id": str(run.id),
                    "summary": message[:500],
                },
                message="فشلت مهمة الصيانة",
            )
            run.audit_log_id = audit.id
            await self.session.commit()
            await self.session.refresh(run)
            if isinstance(exc, (ValidationError, ConflictError, NotFoundError)):
                raise
            raise ValidationError(message) from exc
        finally:
            async with _MAINTENANCE_LOCK:
                _MAINTENANCE_BUSY = False

    async def list_history(
        self,
        *,
        task_key: str | None = None,
        status: str | None = None,
        executed_by_user_id: UUID | None = None,
        sort_by: str = "started_at",
        sort_dir: str = "desc",
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[SystemMaintenanceRun], int]:
        items = await self.runs.list_filtered(
            task_key=task_key,
            status=status,
            executed_by_user_id=executed_by_user_id,
            sort_by=sort_by,
            sort_dir=sort_dir,
            offset=offset,
            limit=limit,
        )
        total = await self.runs.count_filtered(
            task_key=task_key,
            status=status,
            executed_by_user_id=executed_by_user_id,
        )
        return items, total

    async def get_history(self, execution_id: UUID) -> SystemMaintenanceRun:
        row = await self.runs.get_by_id(execution_id)
        if row is None:
            raise NotFoundError("سجل الصيانة غير موجود")
        return row
