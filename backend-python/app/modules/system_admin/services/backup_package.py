"""Build validated .juman backup ZIP packages."""

from __future__ import annotations

import hashlib
import json
import shutil
import tempfile
import zipfile
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from app.exceptions import BusinessError
from app.modules.system_admin.constants import (
    BACKUP_FORMAT,
    BACKUP_FORMAT_VERSION,
    BACKUP_PACKAGE_EXTENSION,
)
from app.modules.system_admin.services.dumpers import BackupDumper
from app.utils.datetime import utc_now


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def resolve_storage_root(root: str | Path) -> Path:
    path = Path(root).expanduser().resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


def confined_path(root: Path, relative: str) -> Path:
    cleaned = relative.replace("\\", "/").lstrip("/")
    if ".." in Path(cleaned).parts:
        raise BusinessError("مسار النسخة الاحتياطية غير صالح")
    target = (root / cleaned).resolve()
    if not str(target).startswith(str(root)):
        raise BusinessError("مسار النسخة الاحتياطية غير صالح")
    return target


@dataclass(frozen=True)
class BuiltBackupPackage:
    filename: str
    storage_path: str
    absolute_path: Path
    checksum_sha256: str
    compressed_size_bytes: int
    format_version: int
    include_media: bool
    app_version: str
    alembic_revision: str | None
    duration_ms: int


@dataclass(frozen=True)
class PackageBuildContext:
    app_version: str
    alembic_head: list[str]
    alembic_current: list[str]
    created_by: UUID | None
    database_engine: str
    database_name: str | None
    default_timezone: str
    hostname: str
    python_version: str
    operating_system: str
    notes: str | None
    include_media: bool
    media_root: Path | None


class BackupPackageBuilder:
    """Assemble dump + manifest + checksums into a single .juman archive."""

    def __init__(self, storage_root: Path) -> None:
        self.storage_root = resolve_storage_root(storage_root)

    async def build(
        self,
        *,
        dumper: BackupDumper,
        context: PackageBuildContext,
    ) -> BuiltBackupPackage:
        started = utc_now()
        stamp = started.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")
        filename = f"juman-backup-{stamp}-{uuid4().hex[:8]}{BACKUP_PACKAGE_EXTENSION}"
        relative = filename
        final_path = confined_path(self.storage_root, relative)
        tmp_archive = final_path.with_suffix(final_path.suffix + ".tmp")

        workdir = Path(tempfile.mkdtemp(prefix="juman-backup-"))
        try:
            dump_path = workdir / "database.dump"
            dump_tool = await dumper.dump(dump_path)
            if not dump_path.is_file() or dump_path.stat().st_size <= 0:
                raise BusinessError("فشل إنشاء نسخة قاعدة البيانات")

            if context.include_media:
                if context.media_root is None or not context.media_root.is_dir():
                    raise BusinessError("مسار الوسائط غير متوفر لتضمينه في النسخة الاحتياطية")
                media_dest = workdir / "media"
                shutil.copytree(context.media_root, media_dest)

            metadata: dict[str, Any] = {
                "hostname": context.hostname,
                "python_version": context.python_version,
                "operating_system": context.operating_system,
                "database_name": context.database_name,
                "default_timezone": context.default_timezone,
                "notes": context.notes,
                "dump_tool": dump_tool,
                "duration_ms": None,
            }
            metadata_path = workdir / "metadata.json"

            payload_paths: list[Path] = [dump_path, metadata_path]
            if context.include_media:
                for path in sorted((workdir / "media").rglob("*")):
                    if path.is_file():
                        payload_paths.append(path)

            # Write metadata first without duration; update after timing.
            duration_ms = int((utc_now() - started).total_seconds() * 1000)
            metadata["duration_ms"] = duration_ms
            metadata_path.write_text(
                json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

            file_entries: list[dict[str, Any]] = []
            checksum_lines: list[str] = []
            for path in payload_paths:
                rel = path.relative_to(workdir).as_posix()
                digest = sha256_file(path)
                size = path.stat().st_size
                file_entries.append({"path": rel, "sha256": digest, "size_bytes": size})
                checksum_lines.append(f"{digest}  {rel}")

            created_at = started.astimezone(UTC).isoformat().replace("+00:00", "Z")
            manifest: dict[str, Any] = {
                "format": BACKUP_FORMAT,
                "format_version": BACKUP_FORMAT_VERSION,
                "app_name": "Juman",
                "app_version": context.app_version,
                "alembic_head": context.alembic_head,
                "alembic_current": context.alembic_current,
                "created_at": created_at,
                "created_by": str(context.created_by) if context.created_by else None,
                "database_engine": context.database_engine,
                "include_media": context.include_media,
                "files": file_entries,
            }
            manifest_path = workdir / "manifest.json"
            manifest_path.write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            checksum_path = workdir / "checksum.sha256"
            checksum_path.write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")

            if tmp_archive.exists():
                tmp_archive.unlink()
            with zipfile.ZipFile(tmp_archive, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                for path in sorted(workdir.rglob("*")):
                    if path.is_file():
                        zf.write(path, arcname=path.relative_to(workdir).as_posix())

            with zipfile.ZipFile(tmp_archive, "r") as zf:
                bad = zf.testzip()
                if bad is not None:
                    raise BusinessError("فشل التحقق من ملف النسخة الاحتياطية")
                if "manifest.json" not in zf.namelist():
                    raise BusinessError("فشل التحقق من ملف النسخة الاحتياطية")

            archive_sha = sha256_file(tmp_archive)
            size_bytes = tmp_archive.stat().st_size
            if final_path.exists():
                final_path.unlink()
            tmp_archive.replace(final_path)

            return BuiltBackupPackage(
                filename=filename,
                storage_path=relative,
                absolute_path=final_path,
                checksum_sha256=archive_sha,
                compressed_size_bytes=size_bytes,
                format_version=BACKUP_FORMAT_VERSION,
                include_media=context.include_media,
                app_version=context.app_version,
                alembic_revision=(
                    context.alembic_current[0] if context.alembic_current else None
                ),
                duration_ms=duration_ms,
            )
        except Exception:
            if tmp_archive.exists():
                tmp_archive.unlink(missing_ok=True)
            if final_path.exists() and final_path.stat().st_size == 0:
                final_path.unlink(missing_ok=True)
            raise
        finally:
            shutil.rmtree(workdir, ignore_errors=True)