"""Ensure on-disk media/backup layout and absolute settings paths."""

from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.settings.constants import SettingKey
from app.utils.datetime import utc_now
from app.utils.logging import get_logger

logger = get_logger(__name__)


def install_root() -> Path:
    env = os.environ.get("JUMAN_INSTALL_DIR", "").strip()
    if env:
        return Path(env).expanduser().resolve()
    cwd = Path.cwd().resolve()
    if (cwd / "backend" / "app").is_dir():
        return cwd
    if (cwd / "app").is_dir() and (cwd.parent / "frontend").is_dir():
        return cwd.parent
    return cwd


def storage_base(root: Path | None = None) -> Path:
    root = root or install_root()
    raw = os.environ.get("MEDIA_STORAGE_ROOT", "").strip()
    if raw:
        base = Path(raw).expanduser()
        if not base.is_absolute():
            base = (root / base).resolve()
        else:
            base = base.resolve()
        if base.name.lower() == "media":
            return base.parent
        return base
    return (root / "storage").resolve()


def ensure_storage_directories(root: Path | None = None) -> dict[str, Path]:
    """Create storage/media and storage/backups under the install tree."""
    root = root or install_root()
    base = storage_base(root)
    media = (base / "media").resolve()
    backups = (base / "backups").resolve()
    for path in (base, media, backups, root / "logs", root / "data"):
        path.mkdir(parents=True, exist_ok=True)
    return {"storage": base, "media": media, "backups": backups}


def resolve_configured_path(raw: str, *, root: Path | None = None) -> Path:
    """Resolve relative setting paths against install root."""
    root = root or install_root()
    path = Path(raw).expanduser()
    if not path.is_absolute():
        path = (root / path).resolve()
    else:
        path = path.resolve()
    return path


async def sync_storage_settings(session: AsyncSession, *, root: Path | None = None) -> dict[str, str]:
    """Upsert absolute media/backup roots in settings (relative seeds break under WinSW)."""
    paths = ensure_storage_directories(root)
    media = str(paths["media"])
    backups = str(paths["backups"])
    for key, value in (
        (SettingKey.MEDIA_STORAGE_ROOT.value, media),
        (SettingKey.BACKUP_STORAGE_ROOT.value, backups),
    ):
        await session.execute(
            text(
                """
                UPDATE settings
                SET value = :value, updated_at = :updated_at
                WHERE key = :key AND is_deleted = false
                """
            ),
            {"key": key, "value": value, "updated_at": utc_now()},
        )
    await session.commit()
    logger.info("storage_layout_synced", extra={"media": media, "backups": backups})
    return {"media_storage_root": media, "backup.storage_root": backups}