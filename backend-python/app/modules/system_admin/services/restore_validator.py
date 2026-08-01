"""Validate .juman backup packages before restore."""

from __future__ import annotations

import json
import shutil
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.exceptions import BusinessError
from app.modules.system_admin.constants import (
    BACKUP_FORMAT,
    SUPPORTED_BACKUP_FORMAT_VERSIONS,
)
from app.modules.system_admin.services.backup_package import sha256_file


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    format: str | None = None
    format_version: int | None = None
    app_version: str | None = None
    alembic_current: list[str] = field(default_factory=list)
    alembic_head: list[str] = field(default_factory=list)
    database_engine: str | None = None
    include_media: bool = False
    package_checksum_sha256: str | None = None
    manifest: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)


def _err(result: ValidationResult, message: str) -> ValidationResult:
    result.ok = False
    result.errors.append(message)
    return result


def _norm_rel(path: str) -> str:
    return path.replace("\\", "/")


class RestoreValidator:
    """Validate archive integrity, checksums, and compatibility."""

    def validate_archive(
        self,
        package_path: Path,
        *,
        live_dialect: str,
        live_alembic_current: list[str],
        live_app_version: str | None = None,
        expected_checksum: str | None = None,
    ) -> ValidationResult:
        result = ValidationResult(ok=True)
        if not package_path.is_file():
            return _err(result, "ملف النسخة الاحتياطية غير موجود")

        result.package_checksum_sha256 = sha256_file(package_path)
        if expected_checksum and expected_checksum.lower() != result.package_checksum_sha256.lower():
            return _err(result, "مجموع التحقق من الأرشيف غير متطابق")

        extract_dir = package_path.parent / f".validate-{package_path.stem}"
        try:
            with zipfile.ZipFile(package_path, "r") as zf:
                bad = zf.testzip()
                if bad is not None:
                    return _err(result, "الأرشيف تالف")
                names = set(zf.namelist())
                required = {"manifest.json", "metadata.json", "database.dump", "checksum.sha256"}
                missing = sorted(required - names)
                if missing:
                    return _err(result, f"ملفات مطلوبة مفقودة: {', '.join(missing)}")

                if extract_dir.exists():
                    shutil.rmtree(extract_dir, ignore_errors=True)
                extract_dir.mkdir(parents=True, exist_ok=True)
                try:
                    zf.extractall(extract_dir)
                except Exception:  # noqa: BLE001
                    return _err(result, "فشل استخراج الأرشيف")
        except zipfile.BadZipFile:
            return _err(result, "الملف ليس أرشيف ZIP صالحاً")
        except BusinessError as exc:
            return _err(result, str(exc))

        try:
            return self._validate_extracted(
                extract_dir,
                result=result,
                live_dialect=live_dialect,
                live_alembic_current=live_alembic_current,
                live_app_version=live_app_version,
            )
        finally:
            shutil.rmtree(extract_dir, ignore_errors=True)

    def _validate_extracted(
        self,
        extract_dir: Path,
        *,
        result: ValidationResult,
        live_dialect: str,
        live_alembic_current: list[str],
        live_app_version: str | None,
    ) -> ValidationResult:
        try:
            manifest = json.loads((extract_dir / "manifest.json").read_text(encoding="utf-8"))
            metadata = json.loads((extract_dir / "metadata.json").read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            return _err(result, "تعذر قراءة البيان أو البيانات الوصفية")

        result.manifest = manifest
        result.metadata = metadata
        result.format = str(manifest.get("format") or "")
        try:
            result.format_version = int(manifest.get("format_version"))
        except Exception:  # noqa: BLE001
            result.format_version = None
        result.app_version = (
            str(manifest["app_version"]) if manifest.get("app_version") is not None else None
        )
        result.alembic_current = [str(x) for x in (manifest.get("alembic_current") or [])]
        result.alembic_head = [str(x) for x in (manifest.get("alembic_head") or [])]
        result.database_engine = (
            str(manifest["database_engine"]) if manifest.get("database_engine") else None
        )
        result.include_media = bool(manifest.get("include_media"))

        if result.format != BACKUP_FORMAT:
            return _err(result, "صيغة النسخة الاحتياطية غير مدعومة")
        if result.format_version not in SUPPORTED_BACKUP_FORMAT_VERSIONS:
            return _err(result, "إصدار صيغة النسخة الاحتياطية غير مدعوم")

        dump_path = extract_dir / "database.dump"
        if not dump_path.is_file() or dump_path.stat().st_size <= 0:
            return _err(result, "ملف قاعدة البيانات مفقود أو فارغ")

        checksum_path = extract_dir / "checksum.sha256"
        checksum_lines = checksum_path.read_text(encoding="utf-8").splitlines()
        expected: dict[str, str] = {}
        for line in checksum_lines:
            line = line.strip()
            if not line:
                continue
            parts = line.split(None, 1)
            if len(parts) != 2:
                return _err(result, "ملف المجاميع غير صالح")
            expected[_norm_rel(parts[1])] = parts[0].lower()

        for rel, digest in expected.items():
            target = extract_dir / rel
            if not target.is_file():
                return _err(result, f"ملف مفقود في الأرشيف: {rel}")
            actual = sha256_file(target)
            if actual.lower() != digest:
                return _err(result, f"مجموع تحقق غير متطابق: {rel}")

        files = manifest.get("files") or []
        if not isinstance(files, list) or not files:
            return _err(result, "قائمة ملفات البيان فارغة")
        for entry in files:
            if not isinstance(entry, dict):
                return _err(result, "عنصر ملفات البيان غير صالح")
            rel = _norm_rel(str(entry.get("path") or ""))
            if not rel:
                return _err(result, "مسار ملف في البيان مفقود")
            target = extract_dir / rel
            if not target.is_file():
                return _err(result, f"ملف مذكور في البيان مفقود: {rel}")
            actual = sha256_file(target)
            declared = str(entry.get("sha256") or "").lower()
            if declared and declared != actual.lower():
                return _err(result, f"مجموع تحقق البيان غير متطابق: {rel}")
            size = entry.get("size_bytes")
            if size is not None and int(size) != target.stat().st_size:
                return _err(result, f"حجم الملف غير متطابق: {rel}")

        if result.database_engine != live_dialect:
            return _err(result, "محرك قاعدة البيانات في النسخة غير متوافق")

        live_set = sorted(live_alembic_current)
        pkg_set = sorted(result.alembic_current)
        if not pkg_set:
            return _err(result, "إصدار مخطط Alembic مفقود في النسخة")
        if pkg_set != live_set:
            return _err(result, "إصدار مخطط قاعدة البيانات غير متوافق")

        if live_app_version and result.app_version and live_app_version != result.app_version:
            result.warnings.append("إصدار التطبيق مختلف عن النسخة (معلوماتي فقط)")

        return result

    def extract_package(self, package_path: Path, dest: Path) -> Path:
        """Extract a validated package into dest; returns dest."""
        if dest.exists():
            shutil.rmtree(dest, ignore_errors=True)
        dest.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(package_path, "r") as zf:
            if zf.testzip() is not None:
                raise BusinessError("الأرشيف تالف")
            zf.extractall(dest)
        return dest