"""BackupService — create, list, download, and soft-delete .juman backups."""

from __future__ import annotations

import asyncio
import platform
import sys
from collections.abc import Iterator
from pathlib import Path
from typing import BinaryIO
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.exceptions import BusinessError, ConflictError, NotFoundError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.modules.system_admin.constants import BackupStatus
from app.modules.system_admin.models.backup import SystemBackup
from app.modules.system_admin.repositories.backup import SystemBackupRepository
from app.modules.system_admin.repositories.maintenance_run import SystemMaintenanceRunRepository
from app.modules.system_admin.repositories.restore import SystemRestoreRepository
from app.modules.system_admin.services.backup_package import (
    BackupPackageBuilder,
    PackageBuildContext,
    confined_path,
    resolve_storage_root,
)
from app.modules.system_admin.services.dumpers import PostgresDumper, SqliteDumper
from app.modules.system_admin.services.system_info import alembic_heads, safe_database_name
from app.services.base import BaseService
from app.utils.datetime import utc_now

_CREATE_LOCK = asyncio.Lock()
_CREATE_BUSY = False


class BackupService(BaseService):
    """Orchestrate backup package creation and history management."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        settings_service: SettingService | None = None,
        audit_service: AuditService | None = None,
        repository: SystemBackupRepository | None = None,
    ) -> None:
        super().__init__(session)
        self.settings_service = settings_service or SettingService(session)
        self.audit = audit_service or AuditService(session)
        self.backups = repository or SystemBackupRepository(session)
        self.restores = SystemRestoreRepository(session)
        self.maintenance_runs = SystemMaintenanceRunRepository(session)

    async def create(
        self,
        *,
        include_media: bool | None = None,
        notes: str | None = None,
        actor_id: UUID | None = None,
        username: str | None = None,
        ip_address: str | None = None,
        bypass_restore_busy: bool = False,
    ) -> SystemBackup:
        global _CREATE_BUSY
        async with _CREATE_LOCK:
            if _CREATE_BUSY or await self.backups.has_running():
                raise ConflictError("نسخة احتياطية قيد التنفيذ")
            if not bypass_restore_busy and await self.restores.has_running():
                raise ConflictError("استعادة قيد التنفيذ")
            if await self.maintenance_runs.has_running():
                raise ConflictError("مهمة صيانة قيد التنفيذ")
            _CREATE_BUSY = True

        try:
            return await self._create_locked(
                include_media=include_media,
                notes=notes,
                actor_id=actor_id,
                username=username,
                ip_address=ip_address,
            )
        finally:
            async with _CREATE_LOCK:
                _CREATE_BUSY = False

    async def _create_locked(
        self,
        *,
        include_media: bool | None,
        notes: str | None,
        actor_id: UUID | None,
        username: str | None,
        ip_address: str | None,
    ) -> SystemBackup:
        if include_media is None:
            include_media = await self.settings_service.get_bool(
                SettingKey.BACKUP_INCLUDE_MEDIA_DEFAULT.value
            )

        storage_root = resolve_storage_root(
            await self.settings_service.get_string(SettingKey.BACKUP_STORAGE_ROOT.value)
        )
        app_settings = get_settings()
        bind = self.session.get_bind()
        dialect = bind.dialect.name
        current = await self._alembic_current()
        heads = alembic_heads()

        started = utc_now()
        row = SystemBackup(
            filename="pending.juman",
            storage_path="pending.juman",
            status=BackupStatus.RUNNING.value,
            format_version=1,
            include_media=bool(include_media),
            app_version=app_settings.app_version,
            alembic_revision=current[0] if current else None,
            created_by_user_id=actor_id,
            created_by=actor_id,
            notes=notes,
            started_at=started,
        )
        await self.backups.add(row)
        await self.session.commit()

        try:
            if dialect == "postgresql":
                dumper = PostgresDumper(app_settings.database_url)
            elif dialect == "sqlite":
                dumper = SqliteDumper(self.session)
            else:
                raise BusinessError("محرك قاعدة البيانات غير مدعوم للنسخ الاحتياطي")

            media_root: Path | None = None
            if include_media:
                media_root_raw = await self.settings_service.get_string(
                    SettingKey.MEDIA_STORAGE_ROOT.value
                )
                media_root = Path(media_root_raw).expanduser().resolve()

            timezone = app_settings.default_timezone
            try:
                timezone = await self.settings_service.get_string(
                    SettingKey.DEFAULT_TIMEZONE.value
                )
            except Exception:  # noqa: BLE001
                pass

            context = PackageBuildContext(
                app_version=app_settings.app_version,
                alembic_head=heads,
                alembic_current=current,
                created_by=actor_id,
                database_engine=dialect,
                database_name=safe_database_name(app_settings.database_url),
                default_timezone=timezone,
                hostname=platform.node() or "unknown",
                python_version=sys.version.split()[0],
                operating_system=platform.platform(),
                notes=notes,
                include_media=bool(include_media),
                media_root=media_root,
            )
            built = await BackupPackageBuilder(storage_root).build(
                dumper=dumper,
                context=context,
            )

            row.filename = built.filename
            row.storage_path = built.storage_path
            row.status = BackupStatus.COMPLETED.value
            row.checksum_sha256 = built.checksum_sha256
            row.compressed_size_bytes = built.compressed_size_bytes
            row.format_version = built.format_version
            row.include_media = built.include_media
            row.app_version = built.app_version
            row.alembic_revision = built.alembic_revision
            finished = utc_now()
            row.error_message = None
            row.updated_by = actor_id
            row.finished_at = finished
            row.duration_ms = max(0, int((finished - started).total_seconds() * 1000))
            await self.session.flush()

            audit = await self.audit.record_create(
                module="system_admin",
                entity_type="system_backup",
                entity_id=row.id,
                new_values={
                    "filename": row.filename,
                    "checksum_sha256": row.checksum_sha256,
                    "compressed_size_bytes": row.compressed_size_bytes,
                    "include_media": row.include_media,
                    "status": row.status,
                },
                user_id=actor_id,
                username=username,
                ip_address=ip_address,
                metadata={
                    "backup_outcome": "success",
                    "filename": row.filename,
                    "checksum_sha256": row.checksum_sha256,
                    "compressed_size_bytes": row.compressed_size_bytes,
                    "include_media": row.include_media,
                },
                message="تم إنشاء نسخة احتياطية",
            )
            row.audit_log_id = audit.id
            await self.session.commit()
            await self.session.refresh(row)
            return row
        except Exception as exc:
            if isinstance(exc, BusinessError):
                message = str(exc)
            else:
                message = f"فشل إنشاء النسخة الاحتياطية ({type(exc).__name__}: {exc})"[:2000]
            finished = utc_now()
            row.status = BackupStatus.FAILED.value
            row.error_message = message[:2000]
            row.updated_by = actor_id
            row.finished_at = finished
            row.duration_ms = max(0, int((finished - started).total_seconds() * 1000))
            # Remove partial archive if present under pending name or built path.
            try:
                pending = confined_path(storage_root, row.storage_path)
                if pending.is_file() and row.storage_path != "pending.juman":
                    pending.unlink(missing_ok=True)
            except Exception:  # noqa: BLE001
                pass
            await self.session.flush()
            audit = await self.audit.record(
                module="system_admin",
                entity_type="system_backup",
                entity_id=row.id,
                action=AuditAction.CUSTOM,
                user_id=actor_id,
                username=username,
                ip_address=ip_address,
                metadata={
                    "backup_outcome": "failure",
                    "error_message": message[:500],
                    "filename": row.filename,
                },
                message="فشل إنشاء النسخة الاحتياطية",
            )
            row.audit_log_id = audit.id
            await self.session.commit()
            await self.session.refresh(row)
            if isinstance(exc, (BusinessError, ConflictError)):
                raise
            raise BusinessError(message) from exc

    async def list(
        self,
        *,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[SystemBackup], int]:
        items = await self.backups.list_filtered(
            sort_by=sort_by,
            sort_dir=sort_dir,
            offset=offset,
            limit=limit,
        )
        total = await self.backups.count_filtered()
        return items, total

    async def get(self, backup_id: UUID) -> SystemBackup:
        row = await self.backups.get_by_id(backup_id)
        if row is None:
            raise NotFoundError("النسخة الاحتياطية غير موجودة")
        return row

    async def open_download(
        self,
        backup_id: UUID,
        *,
        actor_id: UUID | None = None,
        username: str | None = None,
        ip_address: str | None = None,
        audit: bool = True,
    ) -> tuple[SystemBackup, BinaryIO]:
        row = await self.get(backup_id)
        if row.status != BackupStatus.COMPLETED.value:
            raise NotFoundError("النسخة الاحتياطية غير متاحة للتحميل")
        root = resolve_storage_root(
            await self.settings_service.get_string(SettingKey.BACKUP_STORAGE_ROOT.value)
        )
        path = confined_path(root, row.storage_path)
        if not path.is_file():
            raise NotFoundError("ملف النسخة الاحتياطية غير موجود")
        if audit:
            await self.audit.record(
                module="system_admin",
                entity_type="system_backup",
                entity_id=row.id,
                action=AuditAction.EXPORT,
                user_id=actor_id,
                username=username,
                ip_address=ip_address,
                metadata={
                    "backup_outcome": "download",
                    "filename": row.filename,
                    "checksum_sha256": row.checksum_sha256,
                },
                message="تم تنزيل النسخة الاحتياطية",
            )
            await self.session.commit()
        return row, path.open("rb")

    def iter_file(self, handle: BinaryIO, *, chunk_size: int = 1024 * 1024) -> Iterator[bytes]:
        try:
            while True:
                chunk = handle.read(chunk_size)
                if not chunk:
                    break
                yield chunk
        finally:
            handle.close()

    async def soft_delete(
        self,
        backup_id: UUID,
        *,
        actor_id: UUID | None = None,
        username: str | None = None,
        ip_address: str | None = None,
    ) -> SystemBackup:
        row = await self.get(backup_id)
        old = {
            "status": row.status,
            "filename": row.filename,
            "is_deleted": row.is_deleted,
        }
        root = resolve_storage_root(
            await self.settings_service.get_string(SettingKey.BACKUP_STORAGE_ROOT.value)
        )
        try:
            path = confined_path(root, row.storage_path)
            if path.is_file():
                path.unlink()
        except BusinessError:
            pass

        row.status = BackupStatus.DELETED.value
        await self.backups.delete(row, deleted_by=actor_id)
        audit = await self.audit.record(
            module="system_admin",
            entity_type="system_backup",
            entity_id=row.id,
            action=AuditAction.DELETE,
            old_values=old,
            new_values={
                "status": row.status,
                "filename": row.filename,
                "is_deleted": True,
            },
            user_id=actor_id,
            username=username,
            ip_address=ip_address,
            metadata={"backup_outcome": "deleted", "filename": row.filename},
            message="تم حذف النسخة الاحتياطية",
        )
        row.audit_log_id = audit.id
        await self.session.commit()
        await self.session.refresh(row)
        return row

    async def _alembic_current(self) -> list[str]:
        from sqlalchemy import text

        try:
            result = await self.session.execute(text("SELECT version_num FROM alembic_version"))
            return sorted(str(row[0]) for row in result.all())
        except Exception:  # noqa: BLE001
            return []
