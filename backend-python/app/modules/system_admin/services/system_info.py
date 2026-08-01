"""Gather safe operational system information."""

from __future__ import annotations

import platform
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from fastapi import Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.constants import APP_DISPLAY_NAME, APP_NAME_AR
from app.modules.settings.constants import SettingKey
from app.modules.settings.services.setting import SettingService
from app.modules.system_admin.schemas.system import SystemInfoResponse
from app.services.base import BaseService
from app.utils.datetime import ensure_utc, utc_now


def _backend_root() -> Path:
    return Path(__file__).resolve().parents[4]


def safe_database_name(database_url: str) -> str | None:
    """Extract database name only; never return credentials or full DSN."""
    try:
        normalized = database_url.replace("postgresql+asyncpg://", "postgresql://", 1)
        normalized = normalized.replace("sqlite+aiosqlite://", "sqlite://", 1)
        parsed = urlparse(normalized)
        if parsed.scheme.startswith("sqlite"):
            path = parsed.path or ""
            if path in {"", "/", ":memory:"} or "mode=memory" in (parsed.query or ""):
                return ":memory:"
            return Path(path).name or None
        name = (parsed.path or "").lstrip("/").split("?")[0]
        return name or None
    except Exception:  # noqa: BLE001
        return None


def alembic_heads() -> list[str]:
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    cfg = Config(str(_backend_root() / "alembic.ini"))
    cfg.set_main_option("script_location", str(_backend_root() / "alembic"))
    script = ScriptDirectory.from_config(cfg)
    return sorted(script.get_heads())


class SystemInfoService(BaseService):
    def __init__(self, session: AsyncSession, *, settings_service: SettingService) -> None:
        super().__init__(session)
        self.settings_service = settings_service

    async def get_info(self, request: Request | None = None) -> SystemInfoResponse:
        settings = get_settings()
        now = utc_now()
        started_at: datetime | None = None
        uptime: float | None = None
        if request is not None:
            raw = getattr(request.app.state, "started_at", None)
            if isinstance(raw, datetime):
                started_at = ensure_utc(raw)
                uptime = max(0.0, (now - started_at).total_seconds())

        timezone = settings.default_timezone
        try:
            timezone = await self.settings_service.get_string(SettingKey.DEFAULT_TIMEZONE.value)
        except Exception:  # noqa: BLE001
            pass

        media_provider: str | None = None
        media_root: str | None = None
        try:
            media_provider = await self.settings_service.get_string(
                SettingKey.MEDIA_STORAGE_PROVIDER.value
            )
            media_root = await self.settings_service.get_string(
                SettingKey.MEDIA_STORAGE_ROOT.value
            )
        except Exception:  # noqa: BLE001
            pass

        heads = alembic_heads()
        current = await self._alembic_current()
        dialect, server_version, size_bytes = await self._database_details()

        return SystemInfoResponse(
            app_name=APP_DISPLAY_NAME,
            app_name_ar=APP_NAME_AR,
            app_version=settings.app_version,
            api_version="v1",
            environment=settings.app_env.value,
            python_version=sys.version.split()[0],
            operating_system=platform.platform(),
            started_at=started_at,
            uptime_seconds=uptime,
            server_time_utc=now,
            default_timezone=timezone,
            alembic_head=heads,
            alembic_current=current,
            migrations_pending=sorted(current) != sorted(heads) if current else bool(heads),
            database_dialect=dialect,
            database_name=safe_database_name(settings.database_url),
            database_server_version=server_version,
            database_size_bytes=size_bytes,
            media_storage_provider=media_provider,
            media_storage_root=media_root,
            redis_enabled=settings.redis_enabled,
            redis_configured=settings.redis_is_configured,
        )

    async def _alembic_current(self) -> list[str]:
        try:
            result = await self.session.execute(text("SELECT version_num FROM alembic_version"))
            rows = [str(row[0]) for row in result.all()]
            return sorted(rows)
        except Exception:  # noqa: BLE001
            return []

    async def _database_details(self) -> tuple[str | None, str | None, int | None]:
        dialect_name: str | None = None
        server_version: str | None = None
        size_bytes: int | None = None
        try:
            bind = self.session.get_bind()
            dialect_name = bind.dialect.name
            if dialect_name == "postgresql":
                ver = (await self.session.execute(text("SELECT version()"))).scalar_one()
                server_version = str(ver)[:200]
                size = (
                    await self.session.execute(text("SELECT pg_database_size(current_database())"))
                ).scalar_one()
                size_bytes = int(size)
            else:
                ver = (await self.session.execute(text("SELECT sqlite_version()"))).scalar_one()
                server_version = f"sqlite {ver}"
        except Exception:  # noqa: BLE001
            pass
        return dialect_name, server_version, size_bytes
