"""RestoreService — validate and apply .juman packages with safety backup."""

from __future__ import annotations

import asyncio
import json
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.exceptions import BusinessError, ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.modules.system_admin.constants import (
    PRE_RESTORE_SAFETY_NOTES,
    BackupStatus,
    RestoreSourceType,
    RestoreStatus,
)
from app.modules.system_admin.models.backup import SystemBackup
from app.modules.system_admin.models.restore import SystemRestore
from app.modules.system_admin.repositories.backup import SystemBackupRepository
from app.modules.system_admin.repositories.maintenance_run import SystemMaintenanceRunRepository
from app.modules.system_admin.repositories.restore import SystemRestoreRepository
from app.modules.system_admin.services.backup import BackupService
from app.modules.system_admin.services.backup_package import (
    confined_path,
    resolve_storage_root,
    sha256_file,
)
from app.modules.system_admin.services.restore_applier import (
    PostgresRestoreApplier,
    SqliteRestoreApplier,
)
from app.modules.system_admin.services.restore_validator import (
    RestoreValidator,
    ValidationResult,
)
from app.services.base import BaseService
from app.utils.datetime import utc_now

_RESTORE_LOCK = asyncio.Lock()
_RESTORE_BUSY = False


class RestoreService(BaseService):
    """Orchestrate validation, safety backup, apply, and rollback."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        settings_service: SettingService | None = None,
        audit_service: AuditService | None = None,
        backup_service: BackupService | None = None,
        restore_repository: SystemRestoreRepository | None = None,
        backup_repository: SystemBackupRepository | None = None,
        validator: RestoreValidator | None = None,
    ) -> None:
        super().__init__(session)
        self.settings_service = settings_service or SettingService(session)
        self.audit = audit_service or AuditService(session)
        self.backups = backup_repository or SystemBackupRepository(session)
        self.restores = restore_repository or SystemRestoreRepository(session)
        self.maintenance_runs = SystemMaintenanceRunRepository(session)
        self.backup_service = backup_service or BackupService(
            session,
            settings_service=self.settings_service,
            audit_service=self.audit,
            repository=self.backups,
        )
        self.validator = validator or RestoreValidator()

    async def validate(
        self,
        *,
        backup_id: UUID | None = None,
        upload_path: Path | None = None,
        expected_checksum: str | None = None,
        actor_id: UUID | None = None,
        username: str | None = None,
        ip_address: str | None = None,
    ) -> ValidationResult:
        package_path = await self._resolve_package_path(
            backup_id=backup_id, upload_path=upload_path
        )
        live_dialect = self.session.get_bind().dialect.name
        live_alembic = await self._alembic_current()
        app_version = get_settings().app_version
        result = self.validator.validate_archive(
            package_path,
            live_dialect=live_dialect,
            live_alembic_current=live_alembic,
            live_app_version=app_version,
            expected_checksum=expected_checksum,
        )
        await self.audit.record(
            module="system_admin",
            entity_type="system_restore_validation",
            entity_id=str(backup_id) if backup_id else None,
            action=AuditAction.CUSTOM,
            user_id=actor_id,
            username=username,
            ip_address=ip_address,
            metadata={
                "restore_outcome": "validation_ok" if result.ok else "validation_failed",
                "ok": result.ok,
                "errors": result.errors,
                "package_checksum_sha256": result.package_checksum_sha256,
                "source_backup_id": str(backup_id) if backup_id else None,
            },
            message="تم التحقق من النسخة الاحتياطية"
            if result.ok
            else "فشل التحقق من النسخة الاحتياطية",
        )
        await self.session.commit()
        return result

    async def restore(
        self,
        *,
        backup_id: UUID | None = None,
        upload_path: Path | None = None,
        confirm: bool = False,
        confirm_checksum: str | None = None,
        notes: str | None = None,
        actor_id: UUID | None = None,
        username: str | None = None,
        ip_address: str | None = None,
    ) -> SystemRestore:
        if not confirm:
            raise ValidationError("يجب تأكيد عملية الاستعادة")
        if not confirm_checksum or not confirm_checksum.strip():
            raise ValidationError("مجموع التحقق للتأكيد مطلوب")

        global _RESTORE_BUSY
        async with _RESTORE_LOCK:
            if _RESTORE_BUSY or await self.restores.has_running():
                raise ConflictError("استعادة قيد التنفيذ")
            if await self.backups.has_running():
                raise ConflictError("نسخة احتياطية قيد التنفيذ")
            if await self.maintenance_runs.has_running():
                raise ConflictError("مهمة صيانة قيد التنفيذ")
            _RESTORE_BUSY = True

        workdir: Path | None = None
        upload_cleanup: Path | None = upload_path
        try:
            return await self._restore_locked(
                backup_id=backup_id,
                upload_path=upload_path,
                confirm_checksum=confirm_checksum.strip().lower(),
                notes=notes,
                actor_id=actor_id,
                username=username,
                ip_address=ip_address,
            )
        finally:
            async with _RESTORE_LOCK:
                _RESTORE_BUSY = False
            if upload_cleanup is not None and upload_cleanup.exists():
                try:
                    upload_cleanup.unlink(missing_ok=True)
                except OSError:
                    pass

    async def _restore_locked(
        self,
        *,
        backup_id: UUID | None,
        upload_path: Path | None,
        confirm_checksum: str,
        notes: str | None,
        actor_id: UUID | None,
        username: str | None,
        ip_address: str | None,
    ) -> SystemRestore:
        package_path = await self._resolve_package_path(
            backup_id=backup_id, upload_path=upload_path
        )
        actual_checksum = sha256_file(package_path)
        if actual_checksum.lower() != confirm_checksum.lower():
            raise ValidationError("مجموع التحقق للتأكيد غير متطابق")

        source_type = (
            RestoreSourceType.BACKUP_ID.value
            if backup_id is not None
            else RestoreSourceType.UPLOAD.value
        )
        live_dialect = self.session.get_bind().dialect.name
        live_alembic = await self._alembic_current()
        validation = self.validator.validate_archive(
            package_path,
            live_dialect=live_dialect,
            live_alembic_current=live_alembic,
            live_app_version=get_settings().app_version,
            expected_checksum=confirm_checksum,
        )
        if not validation.ok:
            raise BusinessError(validation.errors[0] if validation.errors else "فشل التحقق")

        started = utc_now()
        restore_id = uuid4()
        row = SystemRestore(
            id=restore_id,
            status=RestoreStatus.RUNNING.value,
            source_type=source_type,
            source_backup_id=backup_id,
            source_filename=package_path.name,
            package_checksum_sha256=validation.package_checksum_sha256,
            format_version=validation.format_version,
            app_version=validation.app_version,
            alembic_revision=validation.alembic_current[0] if validation.alembic_current else None,
            started_at=started,
            created_by_user_id=actor_id,
            created_by=actor_id,
            notes=notes,
        )
        await self.restores.add(row)
        await self.session.commit()

        await self.audit.record(
            module="system_admin",
            entity_type="system_restore",
            entity_id=restore_id,
            action=AuditAction.CUSTOM,
            user_id=actor_id,
            username=username,
            ip_address=ip_address,
            metadata={"restore_outcome": "started", "source_type": source_type},
            message="بدء استعادة النظام",
        )
        await self.session.commit()

        workdir = Path(tempfile.mkdtemp(prefix="juman-restore-"))
        sidecar_path = workdir / "sidecar.json"
        extract_dir = workdir / "package"
        safety: SystemBackup | None = None
        safety_snapshot: dict[str, Any] | None = None
        apply_started = False
        alembic_revision = row.alembic_revision
        sidecar: dict[str, Any] = {}
        storage_root = resolve_storage_root(
            await self.settings_service.get_string(SettingKey.BACKUP_STORAGE_ROOT.value)
        )

        try:
            # Safety backup (mandatory)
            safety = await self.backup_service.create(
                include_media=False,
                notes=PRE_RESTORE_SAFETY_NOTES,
                actor_id=actor_id,
                username=username,
                ip_address=ip_address,
                bypass_restore_busy=True,
            )
            if safety.status != BackupStatus.COMPLETED.value:
                raise BusinessError("فشل إنشاء النسخة الاحتياطية الوقائية")
            # Snapshot ORM fields before any dump apply can detach the session
            safety_snapshot = {
                "id": safety.id,
                "filename": safety.filename,
                "storage_path": safety.storage_path,
                "checksum_sha256": safety.checksum_sha256,
                "compressed_size_bytes": safety.compressed_size_bytes,
                "storage_root": str(storage_root),
            }
            safety_path = confined_path(storage_root, safety_snapshot["storage_path"])
            safety_check = self.validator.validate_archive(
                safety_path,
                live_dialect=live_dialect,
                live_alembic_current=await self._alembic_current(),
                live_app_version=get_settings().app_version,
            )
            if not safety_check.ok:
                raise BusinessError("فشل التحقق من النسخة الاحتياطية الوقائية")

            row.safety_backup_id = safety_snapshot["id"]
            await self.session.commit()

            sidecar = {
                "restore_id": str(restore_id),
                "actor_id": str(actor_id) if actor_id else None,
                "username": username,
                "source_type": source_type,
                "source_backup_id": str(backup_id) if backup_id else None,
                "source_filename": package_path.name,
                "package_checksum_sha256": validation.package_checksum_sha256,
                "safety_backup_id": str(safety_snapshot["id"]),
                "safety_backup_storage_path": safety_snapshot["storage_path"],
                "safety_backup_filename": safety_snapshot["filename"],
                "safety_checksum_sha256": safety_snapshot["checksum_sha256"],
                "safety_compressed_size_bytes": safety_snapshot["compressed_size_bytes"],
                "storage_root": str(storage_root),
                "format_version": validation.format_version,
                "app_version": validation.app_version,
                "alembic_revision": alembic_revision,
                "notes": notes,
                "started_at": started.isoformat(),
                "include_media": validation.include_media,
            }
            sidecar_path.write_text(
                json.dumps(sidecar, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

            self.validator.extract_package(package_path, extract_dir)
            dump_path = extract_dir / "database.dump"
            apply_started = True
            await self._apply_dump(dump_path)

            warning: str | None = None
            if validation.include_media and (extract_dir / "media").is_dir():
                try:
                    await self._restore_media(extract_dir / "media")
                except Exception as media_exc:  # noqa: BLE001
                    warning = f"تمت استعادة قاعدة البيانات مع تحذير الوسائط: {media_exc}"[:2000]

            finished = utc_now()
            await self._rewrite_history_after_success(
                sidecar=sidecar,
                warning_message=warning,
                finished_at=finished,
                actor_id=actor_id,
                username=username,
                ip_address=ip_address,
            )
            restored = await self.restores.get_by_id(restore_id)
            if restored is None:
                raise BusinessError("تعذر قراءة سجل الاستعادة بعد النجاح")
            return restored
        except Exception as exc:
            message = str(exc) if str(exc) else "فشل استعادة النظام"
            if isinstance(exc, (BusinessError, ConflictError, ValidationError)):
                message = str(exc)
            else:
                message = f"فشل استعادة النظام ({type(exc).__name__}: {exc})"[:2000]

            if apply_started and safety_snapshot is not None:
                try:
                    await self._rollback_with_safety_snapshot(safety_snapshot)
                except Exception as rollback_exc:  # noqa: BLE001
                    message = (
                        f"{message}; فشل التراجع التلقائي ({type(rollback_exc).__name__})"
                    )[:2000]

            finished = utc_now()
            await self._rewrite_history_after_failure(
                sidecar_path=sidecar_path if sidecar_path.exists() else None,
                restore_id=restore_id,
                error_message=message,
                finished_at=finished,
                started_at=started,
                actor_id=actor_id,
                username=username,
                ip_address=ip_address,
                source_type=source_type,
                source_backup_id=backup_id,
                source_filename=package_path.name,
                package_checksum=validation.package_checksum_sha256,
                safety_snapshot=safety_snapshot,
                notes=notes,
                format_version=validation.format_version,
                app_version=validation.app_version,
                alembic_revision=alembic_revision,
            )
            if isinstance(exc, (BusinessError, ConflictError, ValidationError)):
                raise
            raise BusinessError(message) from exc
        finally:
            if workdir is not None:
                shutil.rmtree(workdir, ignore_errors=True)

    async def list(
        self,
        *,
        sort_by: str = "started_at",
        sort_dir: str = "desc",
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[SystemRestore], int]:
        items = await self.restores.list_filtered(
            sort_by=sort_by, sort_dir=sort_dir, offset=offset, limit=limit
        )
        total = await self.restores.count_filtered()
        return items, total

    async def get(self, restore_id: UUID) -> SystemRestore:
        row = await self.restores.get_by_id(restore_id)
        if row is None:
            raise NotFoundError("سجل الاستعادة غير موجود")
        return row

    async def _resolve_package_path(
        self,
        *,
        backup_id: UUID | None,
        upload_path: Path | None,
    ) -> Path:
        if (backup_id is None) == (upload_path is None):
            raise ValidationError("يجب تحديد معرف النسخة أو ملف الرفع فقط")
        if upload_path is not None:
            if not upload_path.is_file():
                raise NotFoundError("ملف النسخة الاحتياطية غير موجود")
            return upload_path

        assert backup_id is not None
        backup = await self.backups.get_by_id(backup_id)
        if backup is None or backup.status != BackupStatus.COMPLETED.value:
            raise NotFoundError("النسخة الاحتياطية غير متاحة للاستعادة")
        storage_root = resolve_storage_root(
            await self.settings_service.get_string(SettingKey.BACKUP_STORAGE_ROOT.value)
        )
        path = confined_path(storage_root, backup.storage_path)
        if not path.is_file():
            raise NotFoundError("ملف النسخة الاحتياطية غير موجود")
        return path

    async def _apply_dump(self, dump_path: Path) -> None:
        dialect = self.session.get_bind().dialect.name
        if dialect == "postgresql":
            await PostgresRestoreApplier(get_settings().database_url).apply(dump_path)
        elif dialect == "sqlite":
            await SqliteRestoreApplier(self.session).apply(dump_path)
        else:
            raise BusinessError("محرك قاعدة البيانات غير مدعوم للاستعادة")
        await self.session.rollback()
        self.session.expunge_all()

    async def _rollback_with_safety_snapshot(self, safety_snapshot: dict[str, Any]) -> None:
        root_raw = safety_snapshot.get("storage_root")
        if root_raw:
            storage_root = Path(root_raw).expanduser().resolve()
        else:
            storage_root = resolve_storage_root(
                await self.settings_service.get_string(SettingKey.BACKUP_STORAGE_ROOT.value)
            )
        safety_archive = confined_path(storage_root, safety_snapshot["storage_path"])
        extract = Path(tempfile.mkdtemp(prefix="juman-safety-"))
        try:
            with zipfile.ZipFile(safety_archive, "r") as zf:
                zf.extract("database.dump", path=extract)
            await self._apply_dump(extract / "database.dump")
        finally:
            shutil.rmtree(extract, ignore_errors=True)

    async def _restore_media(self, media_src: Path) -> None:
        root_raw = await self.settings_service.get_string(SettingKey.MEDIA_STORAGE_ROOT.value)
        media_root = Path(root_raw).expanduser().resolve()
        media_root.mkdir(parents=True, exist_ok=True)
        # Replace tree contents carefully: copy into root
        for item in media_src.rglob("*"):
            if item.is_file():
                rel = item.relative_to(media_src)
                dest = media_root / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(item, dest)

    async def _rewrite_history_after_success(
        self,
        *,
        sidecar: dict[str, Any],
        warning_message: str | None,
        finished_at,
        actor_id: UUID | None,
        username: str | None,
        ip_address: str | None,
    ) -> None:
        self.session.expunge_all()
        restore_id = UUID(sidecar["restore_id"])
        started_at = utc_now()  # fallback
        from datetime import datetime

        try:
            started_at = datetime.fromisoformat(sidecar["started_at"])
        except Exception:  # noqa: BLE001
            pass
        duration = int((finished_at - started_at).total_seconds() * 1000)

        # Ensure safety backup history row exists (dump won't include it)
        safety_id = UUID(sidecar["safety_backup_id"])
        existing_safety = await self.backups.get_by_id(safety_id, include_deleted=True)
        if existing_safety is None:
            safety_row = SystemBackup(
                id=safety_id,
                filename=sidecar["safety_backup_filename"],
                storage_path=sidecar["safety_backup_storage_path"],
                status=BackupStatus.COMPLETED.value,
                checksum_sha256=sidecar.get("safety_checksum_sha256"),
                compressed_size_bytes=sidecar.get("safety_compressed_size_bytes"),
                format_version=1,
                include_media=False,
                notes=PRE_RESTORE_SAFETY_NOTES,
                created_by_user_id=actor_id,
                created_by=actor_id,
            )
            self.session.add(safety_row)
            await self.session.flush()

        existing = await self.restores.get_by_id(restore_id, include_deleted=True)
        if existing is None:
            existing = SystemRestore(
                id=restore_id,
                status=RestoreStatus.COMPLETED.value,
                source_type=sidecar["source_type"],
                source_backup_id=UUID(sidecar["source_backup_id"])
                if sidecar.get("source_backup_id")
                else None,
                source_filename=sidecar["source_filename"],
                package_checksum_sha256=sidecar.get("package_checksum_sha256"),
                safety_backup_id=safety_id,
                format_version=sidecar.get("format_version"),
                app_version=sidecar.get("app_version"),
                alembic_revision=sidecar.get("alembic_revision"),
                started_at=started_at,
                finished_at=finished_at,
                duration_ms=duration,
                created_by_user_id=actor_id,
                created_by=actor_id,
                notes=sidecar.get("notes"),
                warning_message=warning_message,
            )
            self.session.add(existing)
        else:
            existing.status = RestoreStatus.COMPLETED.value
            existing.finished_at = finished_at
            existing.duration_ms = duration
            existing.warning_message = warning_message
            existing.error_message = None
            existing.safety_backup_id = safety_id

        await self.session.flush()
        audit = await self.audit.record(
            module="system_admin",
            entity_type="system_restore",
            entity_id=restore_id,
            action=AuditAction.CUSTOM,
            user_id=actor_id,
            username=username,
            ip_address=ip_address,
            metadata={
                "restore_outcome": "success",
                "safety_backup_id": str(safety_id),
                "warning_message": warning_message,
            },
            message="تمت استعادة النظام بنجاح",
        )
        existing.audit_log_id = audit.id
        await self.session.commit()
        await self.session.refresh(existing)

    async def _rewrite_history_after_failure(
        self,
        *,
        sidecar_path: Path | None,
        restore_id: UUID,
        error_message: str,
        finished_at,
        started_at,
        actor_id: UUID | None,
        username: str | None,
        ip_address: str | None,
        source_type: str,
        source_backup_id: UUID | None,
        source_filename: str,
        package_checksum: str | None,
        safety_snapshot: dict[str, Any] | None,
        notes: str | None,
        format_version: int | None,
        app_version: str | None,
        alembic_revision: str | None,
    ) -> None:
        self.session.expunge_all()
        duration = int((finished_at - started_at).total_seconds() * 1000)
        sidecar: dict[str, Any] = {}
        if sidecar_path is not None and sidecar_path.is_file():
            try:
                sidecar = json.loads(sidecar_path.read_text(encoding="utf-8"))
            except Exception:  # noqa: BLE001
                sidecar = {}

        snap = safety_snapshot
        if snap is None and sidecar.get("safety_backup_id"):
            snap = {
                "id": UUID(sidecar["safety_backup_id"]),
                "filename": sidecar.get("safety_backup_filename") or "safety.juman",
                "storage_path": sidecar.get("safety_backup_storage_path") or "safety.juman",
                "checksum_sha256": sidecar.get("safety_checksum_sha256"),
                "compressed_size_bytes": sidecar.get("safety_compressed_size_bytes"),
            }

        safety_id = snap["id"] if snap else None
        if safety_id is not None and not isinstance(safety_id, UUID):
            safety_id = UUID(str(safety_id))

        if snap is not None and safety_id is not None:
            existing_safety = await self.backups.get_by_id(safety_id, include_deleted=True)
            if existing_safety is None:
                self.session.add(
                    SystemBackup(
                        id=safety_id,
                        filename=snap["filename"],
                        storage_path=snap["storage_path"],
                        status=BackupStatus.COMPLETED.value,
                        checksum_sha256=snap.get("checksum_sha256"),
                        compressed_size_bytes=snap.get("compressed_size_bytes"),
                        format_version=1,
                        include_media=False,
                        notes=PRE_RESTORE_SAFETY_NOTES,
                        created_by_user_id=actor_id,
                        created_by=actor_id,
                    )
                )
                await self.session.flush()

        existing = await self.restores.get_by_id(restore_id, include_deleted=True)
        if existing is None:
            existing = SystemRestore(
                id=restore_id,
                status=RestoreStatus.FAILED.value,
                source_type=source_type,
                source_backup_id=source_backup_id,
                source_filename=source_filename,
                package_checksum_sha256=package_checksum,
                safety_backup_id=safety_id,
                format_version=format_version,
                app_version=app_version,
                alembic_revision=alembic_revision,
                started_at=started_at,
                finished_at=finished_at,
                duration_ms=duration,
                created_by_user_id=actor_id,
                created_by=actor_id,
                notes=notes,
                error_message=error_message[:2000],
            )
            self.session.add(existing)
        else:
            existing.status = RestoreStatus.FAILED.value
            existing.finished_at = finished_at
            existing.duration_ms = duration
            existing.error_message = error_message[:2000]
            if safety_id is not None:
                existing.safety_backup_id = safety_id

        await self.session.flush()
        audit = await self.audit.record(
            module="system_admin",
            entity_type="system_restore",
            entity_id=restore_id,
            action=AuditAction.CUSTOM,
            user_id=actor_id,
            username=username,
            ip_address=ip_address,
            metadata={"restore_outcome": "failure", "error_message": error_message[:500]},
            message="فشلت استعادة النظام",
        )
        existing.audit_log_id = audit.id
        await self.session.commit()

    async def _alembic_current(self) -> list[str]:
        from sqlalchemy import text

        try:
            result = await self.session.execute(text("SELECT version_num FROM alembic_version"))
            return sorted(str(row[0]) for row in result.all())
        except Exception:  # noqa: BLE001
            return []
