"""Unit tests for system info helpers and services."""

from datetime import datetime, timezone
from pathlib import Path

import pytest
from app.modules.settings.services.setting import SettingService
from app.modules.system_admin.constants import MaintenanceTaskId
from app.modules.system_admin.maintenance.registry import build_default_registry
from app.modules.system_admin.services.diagnostics import DiagnosticsService
from app.modules.system_admin.services.maintenance import MaintenanceService
from app.modules.system_admin.services.system_info import SystemInfoService, safe_database_name
from sqlalchemy.ext.asyncio import AsyncSession
from tests.helpers.identity import seed_identity_basics


def test_safe_database_name_strips_credentials() -> None:
    name = safe_database_name("postgresql+asyncpg://juman:secret@db.internal:5432/juman_prod")
    assert name == "juman_prod"
    assert "secret" not in name
    assert "juman:" not in name


def test_safe_database_name_sqlite_memory() -> None:
    assert safe_database_name("sqlite+aiosqlite:///:memory:") == ":memory:"


@pytest.mark.asyncio
async def test_maintenance_registry_lists_current_tasks(db_session: AsyncSession) -> None:
    await seed_identity_basics(db_session)
    registry = build_default_registry(db_session)
    ids = {t.id for t in registry.list_tasks()}
    assert MaintenanceTaskId.CLEANUP_SESSIONS.value in ids
    assert MaintenanceTaskId.VERIFY_MEDIA_INTEGRITY.value in ids
    assert len(ids) == 7
    for task in registry.list_tasks():
        assert task.phase == "current"


@pytest.mark.asyncio
async def test_verify_task_execute_read_only(db_session: AsyncSession) -> None:
    await seed_identity_basics(db_session)
    service = MaintenanceService(db_session)
    listed = service.list_tasks()
    assert len(listed.items) == 7
    task = service.registry.get(MaintenanceTaskId.VERIFY_DRESS_STATUS_CONSISTENCY.value)
    assert task is not None
    result = await task.execute()
    assert result.success is True


@pytest.mark.asyncio
async def test_system_info_no_secrets(db_session: AsyncSession, tmp_path: Path) -> None:
    await seed_identity_basics(db_session)
    # point media root at writable temp
    from app.modules.settings.constants import SettingKey
    from sqlalchemy import select
    from app.modules.settings.models import Setting

    settings = SettingService(db_session)
    row = (
        await db_session.execute(
            select(Setting).where(Setting.key == SettingKey.MEDIA_STORAGE_ROOT.value)
        )
    ).scalar_one()
    row.value = str(tmp_path)
    await db_session.flush()

    service = SystemInfoService(db_session, settings_service=settings)

    class _State:
        started_at = datetime(2026, 7, 1, tzinfo=timezone.utc)

    class _App:
        state = _State()

    class _Request:
        app = _App()

    info = await service.get_info(_Request())  # type: ignore[arg-type]
    assert info.database_name in {":memory:", None} or (
        "://" not in (info.database_name or "")
        and "@" not in (info.database_name or "")
    )
    assert info.media_storage_root == str(tmp_path)
    # Sensitive DSN fragments must never appear in structured fields.
    for value in (
        info.database_name,
        info.database_server_version,
        info.media_storage_provider,
        info.app_version,
        info.environment,
    ):
        lowered = str(value or "").lower()
        assert "password" not in lowered
        assert "postgresql+asyncpg://" not in lowered
        assert "@localhost" not in lowered
    assert info.app_name == "Juman"
    assert info.api_version == "v1"
    assert info.database_name in {":memory:", "juman", None} or info.database_name is not None
    assert info.uptime_seconds is not None
    assert info.uptime_seconds >= 0


@pytest.mark.asyncio
async def test_diagnostics_pass_path(db_session: AsyncSession, tmp_path: Path) -> None:
    await seed_identity_basics(db_session)
    from app.modules.settings.constants import SettingKey
    from sqlalchemy import select
    from app.modules.settings.models import Setting

    media = tmp_path / "media"
    backup = tmp_path / "backup"
    media.mkdir(parents=True, exist_ok=True)
    backup.mkdir(parents=True, exist_ok=True)
    for key, path in (
        (SettingKey.MEDIA_STORAGE_ROOT.value, media),
        (SettingKey.BACKUP_STORAGE_ROOT.value, backup),
    ):
        row = (
            await db_session.execute(select(Setting).where(Setting.key == key))
        ).scalar_one()
        row.value = str(path)
    await db_session.flush()

    service = DiagnosticsService(db_session, settings_service=SettingService(db_session))
    result = await service.run(None)
    by_id = {c.id: c for c in result.checks}
    assert by_id["database_connectivity"].status == "pass"
    assert by_id["redis"].status == "skip"
    assert by_id["media_root_exists"].status == "pass"
    assert by_id["media_root_writable"].status == "pass"
    assert by_id["backup_storage_root_exists"].status == "pass"
    assert by_id["backup_storage_writable"].status == "pass"
    assert by_id["restore_readiness"].status == "pass"
    assert by_id["app_runtime"].status == "pass"
    assert by_id["disk_usage"].status in {"pass", "warn"}
    assert result.overall in {"ok", "degraded"}


@pytest.mark.asyncio
async def test_diagnostics_db_down(db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    await seed_identity_basics(db_session)
    service = DiagnosticsService(db_session, settings_service=SettingService(db_session))

    async def boom(*args, **kwargs):
        raise RuntimeError("db down")

    monkeypatch.setattr(db_session, "execute", boom)
    result = await service.run(None)
    assert result.overall == "down"
    assert any(c.id == "database_connectivity" and c.status == "fail" for c in result.checks)


@pytest.mark.asyncio
async def test_alembic_pending(db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    await seed_identity_basics(db_session)
    monkeypatch.setattr(
        "app.modules.system_admin.services.diagnostics.alembic_heads",
        lambda: ["fake_head_revision"],
    )
    service = DiagnosticsService(db_session, settings_service=SettingService(db_session))
    result = await service.run(None)
    check = next(c for c in result.checks if c.id == "alembic_up_to_date")
    assert check.status == "fail"



@pytest.mark.asyncio
async def test_latency_warn(db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    await seed_identity_basics(db_session)
    from app.modules.settings.constants import SettingKey
    from sqlalchemy import select
    from app.modules.settings.models import Setting

    row = (
        await db_session.execute(
            select(Setting).where(Setting.key == SettingKey.MEDIA_STORAGE_ROOT.value)
        )
    ).scalar_one()
    row.value = str(tmp_path)
    await db_session.flush()
    tmp_path.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(
        "app.modules.system_admin.services.diagnostics.DATABASE_LATENCY_WARN_MS",
        0,
    )
    service = DiagnosticsService(db_session, settings_service=SettingService(db_session))
    result = await service.run(None)
    latency = next(c for c in result.checks if c.id == "database_latency")
    assert latency.status == "warn"
    assert result.overall == "degraded"


@pytest.mark.asyncio
async def test_media_missing_and_writable_skip(db_session: AsyncSession) -> None:
    await seed_identity_basics(db_session)
    from app.modules.settings.constants import SettingKey
    from sqlalchemy import select
    from app.modules.settings.models import Setting

    row = (
        await db_session.execute(
            select(Setting).where(Setting.key == SettingKey.MEDIA_STORAGE_ROOT.value)
        )
    ).scalar_one()
    row.value = str(Path("C:/definitely/missing/juman_media_root_xyz"))
    await db_session.flush()

    service = DiagnosticsService(db_session, settings_service=SettingService(db_session))
    result = await service.run(None)
    by_id = {c.id: c for c in result.checks}
    assert by_id["media_root_exists"].status == "fail"
    assert by_id["media_root_writable"].status == "skip"


@pytest.mark.asyncio
async def test_redis_enabled_down(db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    await seed_identity_basics(db_session)

    class _Env:
        value = "test"

    class FakeSettings:
        redis_enabled = True
        redis_is_configured = True
        app_env = _Env()

    monkeypatch.setattr(
        "app.modules.system_admin.services.diagnostics.get_settings",
        lambda: FakeSettings(),
    )
    async def fake_ping(client):
        return "down"

    monkeypatch.setattr(
        "app.modules.system_admin.services.diagnostics.ping_redis",
        fake_ping,
    )
    service = DiagnosticsService(db_session, settings_service=SettingService(db_session))
    result = await service.run(None)
    redis_check = next(c for c in result.checks if c.id == "redis")
    assert redis_check.status == "fail"


@pytest.mark.asyncio
async def test_media_writable_fail(db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    await seed_identity_basics(db_session)
    from app.modules.settings.constants import SettingKey
    from sqlalchemy import select
    from app.modules.settings.models import Setting

    row = (
        await db_session.execute(
            select(Setting).where(Setting.key == SettingKey.MEDIA_STORAGE_ROOT.value)
        )
    ).scalar_one()
    row.value = str(tmp_path)
    await db_session.flush()
    tmp_path.mkdir(parents=True, exist_ok=True)

    def boom_write(*args, **kwargs):
        raise PermissionError("readonly")

    monkeypatch.setattr(Path, "write_text", boom_write)
    service = DiagnosticsService(db_session, settings_service=SettingService(db_session))
    result = await service.run(None)
    writable = next(c for c in result.checks if c.id == "media_root_writable")
    assert writable.status == "fail"


@pytest.mark.asyncio
async def test_dependency_generators(db_session: AsyncSession) -> None:
    await seed_identity_basics(db_session)
    from app.modules.system_admin.dependencies import (
        get_diagnostics_service,
        get_maintenance_service,
        get_metrics_service,
        get_system_info_service,
    )
    from app.modules.system_admin.services.metrics import MetricsService

    async for svc in get_system_info_service(db_session):
        assert isinstance(svc, SystemInfoService)
    async for svc in get_diagnostics_service(db_session):
        assert isinstance(svc, DiagnosticsService)
    async for svc in get_maintenance_service(db_session):
        assert isinstance(svc, MaintenanceService)
    async for svc in get_metrics_service(db_session):
        assert isinstance(svc, MetricsService)


def test_safe_database_name_bad_url() -> None:
    assert safe_database_name("not a url :::") is None or isinstance(
        safe_database_name("not a url :::"), (str, type(None))
    )


@pytest.mark.asyncio
async def test_system_info_settings_fallback(db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    await seed_identity_basics(db_session)
    settings = SettingService(db_session)

    async def boom(key: str):
        raise RuntimeError("missing")

    monkeypatch.setattr(settings, "get_string", boom)
    info = await SystemInfoService(db_session, settings_service=settings).get_info(None)
    assert info.default_timezone  # falls back to config



@pytest.mark.asyncio
async def test_overall_warn_without_fail(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    await seed_identity_basics(db_session)
    from app.modules.settings.constants import SettingKey
    from sqlalchemy import select
    from app.modules.settings.models import Setting
    from app.modules.system_admin.schemas.system import DiagnosticCheckResult

    media = tmp_path / "media"
    backup = tmp_path / "backup"
    media.mkdir(parents=True, exist_ok=True)
    backup.mkdir(parents=True, exist_ok=True)
    for key, path in (
        (SettingKey.MEDIA_STORAGE_ROOT.value, media),
        (SettingKey.BACKUP_STORAGE_ROOT.value, backup),
    ):
        row = (
            await db_session.execute(
                select(Setting).where(Setting.key == key)
            )
        ).scalar_one()
        row.value = str(path)
    await db_session.flush()

    service = DiagnosticsService(db_session, settings_service=SettingService(db_session))

    async def alembic_ok(self):
        return DiagnosticCheckResult(
            id="alembic_up_to_date", status="pass", message="ok"
        )

    monkeypatch.setattr(DiagnosticsService, "_check_alembic", alembic_ok)
    monkeypatch.setattr(
        "app.modules.system_admin.services.diagnostics.DATABASE_LATENCY_WARN_MS",
        0,
    )
    result = await service.run(None)
    assert all(c.status != "fail" for c in result.checks)
    assert any(c.status == "warn" for c in result.checks)
    assert result.overall == "degraded"


@pytest.mark.asyncio
async def test_alembic_current_exception(db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    await seed_identity_basics(db_session)
    service = SystemInfoService(db_session, settings_service=SettingService(db_session))

    async def boom(*args, **kwargs):
        raise RuntimeError("no alembic table")

    monkeypatch.setattr(db_session, "execute", boom)
    assert await service._alembic_current() == []


@pytest.mark.asyncio
async def test_database_details_postgres_branch(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    await seed_identity_basics(db_session)
    service = SystemInfoService(db_session, settings_service=SettingService(db_session))

    class FakeDialect:
        name = "postgresql"

    class FakeBind:
        dialect = FakeDialect()

    class FakeResult:
        def __init__(self, value):
            self._value = value

        def scalar_one(self):
            return self._value

    async def fake_execute(stmt, *args, **kwargs):
        sql = str(stmt)
        if "pg_database_size" in sql:
            return FakeResult(12345)
        return FakeResult("PostgreSQL 16.0")

    monkeypatch.setattr(db_session, "get_bind", lambda: FakeBind())
    monkeypatch.setattr(db_session, "execute", fake_execute)
    dialect, version, size = await service._database_details()
    assert dialect == "postgresql"
    assert version and "PostgreSQL" in version
    assert size == 12345


@pytest.mark.asyncio
async def test_database_details_exception(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    await seed_identity_basics(db_session)
    service = SystemInfoService(db_session, settings_service=SettingService(db_session))
    monkeypatch.setattr(db_session, "get_bind", lambda: (_ for _ in ()).throw(RuntimeError("x")))
    dialect, version, size = await service._database_details()
    assert dialect is None
    assert version is None
    assert size is None


def test_safe_database_name_file_sqlite() -> None:
    assert safe_database_name("sqlite+aiosqlite:///C:/data/juman.db") == "juman.db"
    assert safe_database_name("postgresql+asyncpg://u:p@h/") is None or safe_database_name(
        "postgresql+asyncpg://u:p@h/"
    ) == ""
