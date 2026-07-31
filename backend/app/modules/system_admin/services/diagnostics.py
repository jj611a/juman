"""Read-only system diagnostics."""

from __future__ import annotations

import shutil
import time
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import Request
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.storage_layout import ensure_storage_directories, resolve_configured_path
from app.database.redis import ping_redis
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.modules.system_admin.constants import (
    DATABASE_LATENCY_WARN_MS,
    DISK_FREE_WARN_BYTES,
    DiagnosticCheckId,
    DiagnosticStatus,
    OverallDiagnosticStatus,
)
from app.modules.system_admin.schemas.system import DiagnosticCheckResult, DiagnosticsResponse
from app.modules.system_admin.services.backup_package import resolve_storage_root
from app.modules.system_admin.services.system_info import alembic_heads
from app.services.base import BaseService
from app.utils.datetime import ensure_utc, utc_now


class DiagnosticsService(BaseService):
    def __init__(self, session: AsyncSession, *, settings_service: SettingService) -> None:
        super().__init__(session)
        self.settings_service = settings_service

    async def run(self, request: Request | None = None) -> DiagnosticsResponse:
        checks: list[DiagnosticCheckResult] = []
        db_check, latency_ms = await self._check_database()
        checks.append(db_check)
        checks.append(self._check_latency(latency_ms, db_up=db_check.status == DiagnosticStatus.PASS.value))
        checks.append(await self._check_alembic())
        checks.append(await self._check_settings())
        checks.append(await self._check_audit())
        media_exists, media_root = await self._check_media_exists()
        checks.append(media_exists)
        checks.append(await self._check_media_writable(media_root, exists_ok=media_exists.status == DiagnosticStatus.PASS.value))

        checks.append(await self._check_redis(request))

        backup_exists, backup_root = await self._check_backup_exists()
        checks.append(backup_exists)
        checks.append(
            await self._check_backup_writable(
                backup_root, exists_ok=backup_exists.status == DiagnosticStatus.PASS.value
            )
        )
        checks.append(await self._check_restore_readiness())
        checks.append(await self._check_disk_usage())
        checks.append(self._check_app_runtime(request))

        overall = self._overall(checks)
        return DiagnosticsResponse(overall=overall, checked_at=utc_now(), checks=checks)

    def _overall(self, checks: list[DiagnosticCheckResult]) -> str:
        statuses = {c.id: c.status for c in checks}
        if statuses.get(DiagnosticCheckId.DATABASE_CONNECTIVITY.value) == DiagnosticStatus.FAIL.value:
            return OverallDiagnosticStatus.DOWN.value
        if DiagnosticStatus.FAIL.value in statuses.values():
            return OverallDiagnosticStatus.DEGRADED.value
        if DiagnosticStatus.WARN.value in statuses.values():
            return OverallDiagnosticStatus.DEGRADED.value
        return OverallDiagnosticStatus.OK.value

    async def _check_database(self) -> tuple[DiagnosticCheckResult, float | None]:
        started = time.perf_counter()
        try:
            await self.session.execute(text("SELECT 1"))
            latency = (time.perf_counter() - started) * 1000
            return (
                DiagnosticCheckResult(
                    id=DiagnosticCheckId.DATABASE_CONNECTIVITY.value,
                    status=DiagnosticStatus.PASS.value,
                    message="قاعدة البيانات متاحة",
                    latency_ms=round(latency, 2),
                ),
                latency,
            )
        except Exception as exc:  # noqa: BLE001
            return (
                DiagnosticCheckResult(
                    id=DiagnosticCheckId.DATABASE_CONNECTIVITY.value,
                    status=DiagnosticStatus.FAIL.value,
                    message="تعذر الاتصال بقاعدة البيانات",
                    details={"error": type(exc).__name__},
                ),
                None,
            )

    def _check_latency(self, latency_ms: float | None, *, db_up: bool) -> DiagnosticCheckResult:
        if not db_up or latency_ms is None:
            return DiagnosticCheckResult(
                id=DiagnosticCheckId.DATABASE_LATENCY.value,
                status=DiagnosticStatus.SKIP.value,
                message="تم تخطي قياس زمن الاستجابة",
            )
        status = (
            DiagnosticStatus.WARN.value
            if latency_ms >= DATABASE_LATENCY_WARN_MS
            else DiagnosticStatus.PASS.value
        )
        return DiagnosticCheckResult(
            id=DiagnosticCheckId.DATABASE_LATENCY.value,
            status=status,
            message="زمن استجابة قاعدة البيانات ضمن الحد" if status == DiagnosticStatus.PASS.value else "زمن استجابة قاعدة البيانات مرتفع",
            latency_ms=round(latency_ms, 2),
        )

    async def _check_alembic(self) -> DiagnosticCheckResult:
        try:
            heads = alembic_heads()
            result = await self.session.execute(text("SELECT version_num FROM alembic_version"))
            current = sorted(str(row[0]) for row in result.all())
            pending = sorted(current) != sorted(heads)
            if pending:
                return DiagnosticCheckResult(
                    id=DiagnosticCheckId.ALEMBIC_UP_TO_DATE.value,
                    status=DiagnosticStatus.FAIL.value,
                    message="هناك ترحيلات معلقة",
                    details={"current": current, "heads": heads},
                )
            return DiagnosticCheckResult(
                id=DiagnosticCheckId.ALEMBIC_UP_TO_DATE.value,
                status=DiagnosticStatus.PASS.value,
                message="الترحيلات محدثة",
                details={"current": current, "heads": heads},
            )
        except Exception as exc:  # noqa: BLE001
            return DiagnosticCheckResult(
                id=DiagnosticCheckId.ALEMBIC_UP_TO_DATE.value,
                status=DiagnosticStatus.FAIL.value,
                message="تعذر التحقق من حالة الترحيلات",
                details={"error": type(exc).__name__},
            )

    async def _check_settings(self) -> DiagnosticCheckResult:
        try:
            value = await self.settings_service.get_string(SettingKey.DEFAULT_TIMEZONE.value)
            return DiagnosticCheckResult(
                id=DiagnosticCheckId.SETTINGS_AVAILABLE.value,
                status=DiagnosticStatus.PASS.value,
                message="إعدادات النظام متاحة",
                details={"default_timezone": value},
            )
        except Exception as exc:  # noqa: BLE001
            return DiagnosticCheckResult(
                id=DiagnosticCheckId.SETTINGS_AVAILABLE.value,
                status=DiagnosticStatus.FAIL.value,
                message="تعذر قراءة الإعدادات",
                details={"error": type(exc).__name__},
            )

    async def _check_audit(self) -> DiagnosticCheckResult:
        try:
            await self.session.execute(text("SELECT 1 FROM audit_logs LIMIT 1"))
            return DiagnosticCheckResult(
                id=DiagnosticCheckId.AUDIT_AVAILABLE.value,
                status=DiagnosticStatus.PASS.value,
                message="وحدة التدقيق متاحة",
            )
        except Exception as exc:  # noqa: BLE001
            return DiagnosticCheckResult(
                id=DiagnosticCheckId.AUDIT_AVAILABLE.value,
                status=DiagnosticStatus.FAIL.value,
                message="تعذر الوصول إلى سجلات التدقيق",
                details={"error": type(exc).__name__},
            )

    async def _check_media_exists(self) -> tuple[DiagnosticCheckResult, Path | None]:
        try:
            root = await self.settings_service.get_string(SettingKey.MEDIA_STORAGE_ROOT.value)
            path = resolve_configured_path(root)
            if not path.is_dir():
                ensure_storage_directories()
                path.mkdir(parents=True, exist_ok=True)
            if path.exists() and path.is_dir():
                return (
                    DiagnosticCheckResult(
                        id=DiagnosticCheckId.MEDIA_ROOT_EXISTS.value,
                        status=DiagnosticStatus.PASS.value,
                        message="مجلد الوسائط موجود",
                    ),
                    path,
                )
            return (
                DiagnosticCheckResult(
                    id=DiagnosticCheckId.MEDIA_ROOT_EXISTS.value,
                    status=DiagnosticStatus.FAIL.value,
                    message="مجلد الوسائط غير موجود",
                    details={"path": root},
                ),
                path,
            )
        except Exception as exc:  # noqa: BLE001
            return (
                DiagnosticCheckResult(
                    id=DiagnosticCheckId.MEDIA_ROOT_EXISTS.value,
                    status=DiagnosticStatus.FAIL.value,
                    message="تعذر التحقق من مجلد الوسائط",
                    details={"error": type(exc).__name__},
                ),
                None,
            )

    async def _check_media_writable(self, root: Path | None, *, exists_ok: bool) -> DiagnosticCheckResult:
        if not exists_ok or root is None:
            return DiagnosticCheckResult(
                id=DiagnosticCheckId.MEDIA_ROOT_WRITABLE.value,
                status=DiagnosticStatus.SKIP.value,
                message="تم تخطي فحص الكتابة على مجلد الوسائط",
            )
        probe = root / f".juman_diag_{uuid4().hex}.tmp"
        try:
            root.mkdir(parents=True, exist_ok=True)
            probe.write_text("ok", encoding="utf-8")
            probe.unlink(missing_ok=True)
            return DiagnosticCheckResult(
                id=DiagnosticCheckId.MEDIA_ROOT_WRITABLE.value,
                status=DiagnosticStatus.PASS.value,
                message="مجلد الوسائط قابل للكتابة",
            )
        except Exception as exc:  # noqa: BLE001
            try:
                probe.unlink(missing_ok=True)
            except Exception:  # noqa: BLE001
                pass
            return DiagnosticCheckResult(
                id=DiagnosticCheckId.MEDIA_ROOT_WRITABLE.value,
                status=DiagnosticStatus.FAIL.value,
                message="مجلد الوسائط غير قابل للكتابة",
                details={"error": type(exc).__name__},
            )

    async def _check_redis(self, request: Request | None) -> DiagnosticCheckResult:
        settings = get_settings()
        if not settings.redis_enabled or not settings.redis_is_configured:
            return DiagnosticCheckResult(
                id=DiagnosticCheckId.REDIS.value,
                status=DiagnosticStatus.SKIP.value,
                message="Redis غير مفعل",
            )
        client: Redis | None = None
        if request is not None:
            client = getattr(request.app.state, "redis", None)
        status = await ping_redis(client)
        if status == "up":
            return DiagnosticCheckResult(
                id=DiagnosticCheckId.REDIS.value,
                status=DiagnosticStatus.PASS.value,
                message="Redis متاح",
            )
        return DiagnosticCheckResult(
            id=DiagnosticCheckId.REDIS.value,
            status=DiagnosticStatus.FAIL.value,
            message="Redis غير متاح",
            details={"redis_status": status},
        )



    async def _backup_root(self) -> Path:
        raw = await self.settings_service.get_string(SettingKey.BACKUP_STORAGE_ROOT.value)
        path = resolve_configured_path(raw)
        if not path.is_dir():
            ensure_storage_directories()
            path.mkdir(parents=True, exist_ok=True)
        return path

    async def _media_root_path(self) -> Path | None:
        raw = await self.settings_service.get_string(SettingKey.MEDIA_STORAGE_ROOT.value)
        return resolve_configured_path(raw)

    async def _check_backup_exists(self) -> tuple[DiagnosticCheckResult, Path | None]:
        try:
            root = await self._backup_root()
        except Exception as exc:  # noqa: BLE001
            return (
                DiagnosticCheckResult(
                    id=DiagnosticCheckId.BACKUP_STORAGE_ROOT_EXISTS.value,
                    status=DiagnosticStatus.FAIL.value,
                    message="تعذر تحديد مجلد النسخ الاحتياطي",
                    details={"error": type(exc).__name__},
                ),
                None,
            )
        if root.is_dir():
            return (
                DiagnosticCheckResult(
                    id=DiagnosticCheckId.BACKUP_STORAGE_ROOT_EXISTS.value,
                    status=DiagnosticStatus.PASS.value,
                    message="مجلد النسخ الاحتياطي موجود",
                    details={"path_present": True},
                ),
                root,
            )
        return (
            DiagnosticCheckResult(
                id=DiagnosticCheckId.BACKUP_STORAGE_ROOT_EXISTS.value,
                status=DiagnosticStatus.FAIL.value,
                message="مجلد النسخ الاحتياطي غير موجود",
                details={"path_present": False},
            ),
            root,
        )

    async def _check_backup_writable(
        self, root: Path | None, *, exists_ok: bool
    ) -> DiagnosticCheckResult:
        if not exists_ok or root is None:
            return DiagnosticCheckResult(
                id=DiagnosticCheckId.BACKUP_STORAGE_WRITABLE.value,
                status=DiagnosticStatus.SKIP.value,
                message="تم تخطي فحص الكتابة على مجلد النسخ",
            )
        probe = root / ".juman_diag_write_probe"
        try:
            probe.write_text("ok", encoding="utf-8")
            probe.unlink(missing_ok=True)
            return DiagnosticCheckResult(
                id=DiagnosticCheckId.BACKUP_STORAGE_WRITABLE.value,
                status=DiagnosticStatus.PASS.value,
                message="مجلد النسخ قابل للكتابة",
            )
        except OSError as exc:
            return DiagnosticCheckResult(
                id=DiagnosticCheckId.BACKUP_STORAGE_WRITABLE.value,
                status=DiagnosticStatus.FAIL.value,
                message="مجلد النسخ غير قابل للكتابة",
                details={"error": type(exc).__name__},
            )

    async def _check_restore_readiness(self) -> DiagnosticCheckResult:
        bind = self.session.get_bind()
        dialect = bind.dialect.name if bind is not None else ""
        if dialect == "sqlite":
            return DiagnosticCheckResult(
                id=DiagnosticCheckId.RESTORE_READINESS.value,
                status=DiagnosticStatus.PASS.value,
                message="جاهزية الاستعادة متاحة (SQLite)",
                details={"dialect": dialect, "tool": "builtin"},
            )
        if dialect == "postgresql":
            psql = self._find_psql()
            ok = psql is not None
            if ok:
                return DiagnosticCheckResult(
                    id=DiagnosticCheckId.RESTORE_READINESS.value,
                    status=DiagnosticStatus.PASS.value,
                    message="أداة psql متاحة لعمليات الاستعادة",
                    details={"dialect": dialect, "psql": True, "psql_path": psql},
                )
            return DiagnosticCheckResult(
                id=DiagnosticCheckId.RESTORE_READINESS.value,
                status=DiagnosticStatus.WARN.value,
                message="أداة psql غير موجودة — قد تفشل عمليات استعادة Postgres",
                details={"dialect": dialect, "psql": False},
            )
        return DiagnosticCheckResult(
            id=DiagnosticCheckId.RESTORE_READINESS.value,
            status=DiagnosticStatus.WARN.value,
            message="لهجة قاعدة البيانات غير مدعومة للاستعادة",
            details={"dialect": dialect},
        )

    async def _check_disk_usage(self) -> DiagnosticCheckResult:
        roots: dict[str, Path] = {}
        try:
            media = await self._media_root_path()
            if media.is_dir():
                roots["media"] = media
        except Exception:  # noqa: BLE001
            pass
        try:
            backup = await self._backup_root()
            if backup.is_dir():
                roots["backup"] = backup
        except Exception:  # noqa: BLE001
            pass
        if not roots:
            try:
                layout = ensure_storage_directories()
                roots["storage"] = layout["storage"]
            except Exception:  # noqa: BLE001
                pass
        if not roots:
            return DiagnosticCheckResult(
                id=DiagnosticCheckId.DISK_USAGE.value,
                status=DiagnosticStatus.SKIP.value,
                message="تعذر قياس استخدام القرص",
            )
        details: dict[str, object] = {}
        warn = False
        for label, path in roots.items():
            try:
                usage = shutil.disk_usage(path)
                details[f"{label}_free_bytes"] = usage.free
                details[f"{label}_total_bytes"] = usage.total
                if usage.free < DISK_FREE_WARN_BYTES:
                    warn = True
            except OSError as exc:
                details[f"{label}_error"] = type(exc).__name__
                warn = True
        return DiagnosticCheckResult(
            id=DiagnosticCheckId.DISK_USAGE.value,
            status=DiagnosticStatus.WARN.value if warn else DiagnosticStatus.PASS.value,
            message="مساحة القرص منخفضة" if warn else "مساحة القرص كافية",
            details=details,
        )


    @staticmethod
    def _find_psql() -> str | None:
        found = shutil.which("psql")
        if found:
            return found
        import os

        program_files = Path(os.environ.get("ProgramFiles", r"C:\\Program Files"))
        program_files_x86 = Path(os.environ.get("ProgramFiles(x86)", r"C:\\Program Files (x86)"))
        for major in ("16", "17", "15", "14"):
            for base in (program_files, program_files_x86):
                candidate = base / "PostgreSQL" / major / "bin" / "psql.exe"
                if candidate.is_file():
                    return str(candidate)
        return None

    def _check_app_runtime(self, request: Request | None) -> DiagnosticCheckResult:
        settings = get_settings()
        uptime = None
        if request is not None:
            started = getattr(request.app.state, "started_at", None)
            if isinstance(started, datetime):
                uptime = max(0, int((utc_now() - ensure_utc(started)).total_seconds()))
        return DiagnosticCheckResult(
            id=DiagnosticCheckId.APP_RUNTIME.value,
            status=DiagnosticStatus.PASS.value,
            message="معلومات تشغيل التطبيق",
            details={
                "environment": settings.app_env.value,
                "uptime_seconds": uptime,
            },
        )
