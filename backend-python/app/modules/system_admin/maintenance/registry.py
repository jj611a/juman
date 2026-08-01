"""Maintenance task registry — Phase 4 live tasks."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.settings.services.setting import SettingService
from app.modules.system_admin.maintenance.base import MaintenanceTask
from app.modules.system_admin.maintenance.tasks import (
    CleanupOrphanMediaFilesTask,
    CleanupOrphanMediaReferencesTask,
    CleanupSessionsTask,
    VerifyCalendarConsistencyTask,
    VerifyDressStatusConsistencyTask,
    VerifyForeignReferenceIntegrityTask,
    VerifyMediaIntegrityTask,
)


class MaintenanceRegistry:
    """In-process registry of maintenance tasks."""

    def __init__(self) -> None:
        self._tasks: dict[str, MaintenanceTask] = {}

    def register(self, task: MaintenanceTask) -> None:
        self._tasks[task.id] = task

    def get(self, task_id: str) -> MaintenanceTask | None:
        return self._tasks.get(task_id)

    def list_tasks(self) -> list[MaintenanceTask]:
        return [self._tasks[key] for key in sorted(self._tasks)]


def build_default_registry(
    session: AsyncSession,
    *,
    settings_service: SettingService | None = None,
) -> MaintenanceRegistry:
    """Register Phase 4 executable tasks bound to a session."""
    settings = settings_service or SettingService(session)
    registry = MaintenanceRegistry()
    for task in (
        CleanupSessionsTask(session),
        CleanupOrphanMediaReferencesTask(session),
        CleanupOrphanMediaFilesTask(session, settings_service=settings),
        VerifyMediaIntegrityTask(session, settings_service=settings),
        VerifyCalendarConsistencyTask(session),
        VerifyDressStatusConsistencyTask(session),
        VerifyForeignReferenceIntegrityTask(session),
    ):
        registry.register(task)
    return registry
