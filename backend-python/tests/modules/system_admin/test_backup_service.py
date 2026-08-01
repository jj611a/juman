"""Direct BackupService unit tests for coverage."""

from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pytest
from app.exceptions import BusinessError, ConflictError, NotFoundError
from app.modules.settings.constants import SettingKey
from app.modules.settings.models.setting import Setting
from app.modules.settings.services.setting import SettingService
from app.modules.system_admin.constants import BackupStatus
from app.modules.system_admin.models.backup import SystemBackup
from app.modules.system_admin.services import backup as backup_mod
from app.modules.system_admin.services.backup import BackupService
from app.modules.system_admin.services.dumpers import PostgresDumper, libpq_connection_parts
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.modules.settings.seed_helpers import apply_migration_settings_seed


async def _prepare(session: AsyncSession, tmp_path: Path) -> Path:
    await apply_migration_settings_seed(session)
    root = tmp_path / "backups"
    root.mkdir(parents=True, exist_ok=True)
    media = tmp_path / "media"
    media.mkdir(parents=True, exist_ok=True)
    (media / "a.txt").write_text("x", encoding="utf-8")
    for key, value in {
        SettingKey.BACKUP_STORAGE_ROOT.value: str(root),
        SettingKey.BACKUP_INCLUDE_MEDIA_DEFAULT.value: "false",
        SettingKey.MEDIA_STORAGE_ROOT.value: str(media),
        SettingKey.MEDIA_STORAGE_PROVIDER.value: "local",
        SettingKey.DEFAULT_TIMEZONE.value: "Asia/Baghdad",
    }.items():
        result = await session.execute(
            select(Setting).where(Setting.key == key, Setting.is_deleted.is_(False))
        )
        row = result.scalar_one_or_none()
        if row is None:
            session.add(
                Setting(
                    id=uuid4(),
                    key=key,
                    value=value,
                    value_type="boolean" if value in {"true", "false"} else "string",
                    category="system",
                    description=key,
                    is_editable=True,
                )
            )
        else:
            row.value = value
    await session.commit()
    return root


@pytest.fixture(autouse=True)
def _reset_busy() -> None:
    backup_mod._CREATE_BUSY = False


@pytest.mark.asyncio
async def test_service_create_list_get_download_delete(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    root = await _prepare(db_session, tmp_path)
    svc = BackupService(db_session, settings_service=SettingService(db_session))
    row = await svc.create(include_media=True, notes="svc", actor_id=None)
    assert row.status == BackupStatus.COMPLETED.value
    assert (root / row.filename).is_file()

    items, total = await svc.list(sort_by="filename", sort_dir="asc", offset=0, limit=10)
    assert total >= 1
    assert any(i.id == row.id for i in items)

    got = await svc.get(row.id)
    assert got.id == row.id

    entity, handle = await svc.open_download(row.id)
    assert entity.id == row.id
    data = b"".join(svc.iter_file(handle))
    assert len(data) > 0

    await svc.soft_delete(row.id)
    with pytest.raises(NotFoundError):
        await svc.get(row.id)


@pytest.mark.asyncio
async def test_service_busy_conflict(db_session: AsyncSession, tmp_path: Path) -> None:
    await _prepare(db_session, tmp_path)
    svc = BackupService(db_session, settings_service=SettingService(db_session))
    backup_mod._CREATE_BUSY = True
    with pytest.raises(ConflictError):
        await svc.create()
    backup_mod._CREATE_BUSY = False


@pytest.mark.asyncio
async def test_service_running_row_conflict(db_session: AsyncSession, tmp_path: Path) -> None:
    await _prepare(db_session, tmp_path)
    db_session.add(
        SystemBackup(
            filename="running.juman",
            storage_path="running.juman",
            status=BackupStatus.RUNNING.value,
            format_version=1,
            include_media=False,
        )
    )
    await db_session.commit()
    svc = BackupService(db_session, settings_service=SettingService(db_session))
    with pytest.raises(ConflictError):
        await svc.create()


@pytest.mark.asyncio
async def test_service_download_requires_completed(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    await _prepare(db_session, tmp_path)
    failed = SystemBackup(
        filename="failed.juman",
        storage_path="failed.juman",
        status=BackupStatus.FAILED.value,
        format_version=1,
        include_media=False,
    )
    db_session.add(failed)
    await db_session.commit()
    svc = BackupService(db_session, settings_service=SettingService(db_session))
    with pytest.raises(NotFoundError):
        await svc.open_download(failed.id)


@pytest.mark.asyncio
async def test_service_get_missing(db_session: AsyncSession, tmp_path: Path) -> None:
    await _prepare(db_session, tmp_path)
    svc = BackupService(db_session, settings_service=SettingService(db_session))
    with pytest.raises(NotFoundError):
        await svc.get(uuid4())


@pytest.mark.asyncio
async def test_postgres_dumper_missing_pg_dump(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("PG_DUMP", raising=False)
    monkeypatch.delenv("PGDUMP", raising=False)
    monkeypatch.setattr(
        "app.modules.system_admin.services.dumpers.resolve_pg_dump",
        lambda: None,
    )
    dumper = PostgresDumper("postgresql+asyncpg://u:p@localhost:5432/db")
    with pytest.raises(BusinessError):
        await dumper.dump(tmp_path / "x.dump")


def test_libpq_parts_sqlite_style_ignored() -> None:
    url, password = libpq_connection_parts(
        "postgresql+asyncpg://user:pass@127.0.0.1:5432/juman_app"
    )
    assert password == "pass"
    assert "pass" not in url

@pytest.mark.asyncio
async def test_service_create_uses_default_include_media(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    await _prepare(db_session, tmp_path)
    svc = BackupService(db_session, settings_service=SettingService(db_session))
    row = await svc.create()  # include_media None -> setting default false
    assert row.include_media is False
    assert row.status == BackupStatus.COMPLETED.value


@pytest.mark.asyncio
async def test_service_create_failure_path(
    db_session: AsyncSession, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _prepare(db_session, tmp_path)

    async def _boom(self, target):  # noqa: ANN001, ARG001
        raise RuntimeError("forced")

    monkeypatch.setattr(
        "app.modules.system_admin.services.dumpers.SqliteDumper.dump",
        _boom,
    )
    svc = BackupService(db_session, settings_service=SettingService(db_session))
    with pytest.raises(BusinessError):
        await svc.create(include_media=False)
    rows = (await db_session.execute(select(SystemBackup))).scalars().all()
    assert rows[-1].status == BackupStatus.FAILED.value


@pytest.mark.asyncio
async def test_service_download_missing_file(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    root = await _prepare(db_session, tmp_path)
    row = SystemBackup(
        filename="missing.juman",
        storage_path="missing.juman",
        status=BackupStatus.COMPLETED.value,
        format_version=1,
        include_media=False,
        checksum_sha256="abc",
    )
    db_session.add(row)
    await db_session.commit()
    svc = BackupService(db_session, settings_service=SettingService(db_session))
    with pytest.raises(NotFoundError):
        await svc.open_download(row.id)
    assert not (root / "missing.juman").exists()


@pytest.mark.asyncio
async def test_postgres_dumper_success_and_fail(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[list[str]] = []

    class _Completed:
        def __init__(self, code: int, stdout: str = "") -> None:
            self.returncode = code
            self.stdout = stdout
            self.stderr = ""

    def _which(name: str) -> str | None:
        return "/usr/bin/pg_dump" if name == "pg_dump" else None

    def _run(cmd, **kwargs):  # noqa: ANN001, ANN003
        calls.append(list(cmd))
        if "--version" in cmd:
            return _Completed(0, "pg_dump (PostgreSQL) 16.0")
        target = Path(cmd[cmd.index("--file") + 1])
        target.write_text("-- dump\n", encoding="utf-8")
        return _Completed(0)

    monkeypatch.setattr(
        "app.modules.system_admin.services.dumpers.resolve_pg_dump",
        lambda: "/usr/bin/pg_dump",
    )
    monkeypatch.setattr(
        "app.modules.system_admin.services.dumpers.subprocess.run", _run
    )
    dumper = PostgresDumper("postgresql+asyncpg://u:secret@localhost:5432/db")
    out = tmp_path / "database.dump"
    version = await dumper.dump(out)
    assert "pg_dump" in version
    assert out.read_text(encoding="utf-8").startswith("-- dump")
    assert all("secret" not in " ".join(c) for c in calls)

    def _fail(cmd, **kwargs):  # noqa: ANN001, ANN003
        if "--version" in cmd:
            return _Completed(0, "pg_dump (PostgreSQL) 16.0")
        return _Completed(1, "")

    monkeypatch.setattr(
        "app.modules.system_admin.services.dumpers.subprocess.run", _fail
    )
    with pytest.raises(BusinessError):
        await dumper.dump(tmp_path / "bad.dump")


@pytest.mark.asyncio
async def test_service_unsupported_dialect(
    db_session: AsyncSession, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _prepare(db_session, tmp_path)
    svc = BackupService(db_session, settings_service=SettingService(db_session))
    bind = db_session.get_bind()
    monkeypatch.setattr(bind.dialect, "name", "oracle")
    with pytest.raises(BusinessError):
        await svc.create(include_media=False)


@pytest.mark.asyncio
async def test_service_timezone_fallback(
    db_session: AsyncSession, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _prepare(db_session, tmp_path)
    svc = BackupService(db_session, settings_service=SettingService(db_session))
    original = svc.settings_service.get_string

    async def _get_string(key: str) -> str:
        if key == SettingKey.DEFAULT_TIMEZONE.value:
            raise RuntimeError("missing tz")
        return await original(key)

    monkeypatch.setattr(svc.settings_service, "get_string", _get_string)
    row = await svc.create(include_media=False)
    assert row.status == BackupStatus.COMPLETED.value


@pytest.mark.asyncio
async def test_service_alembic_current_empty(
    db_session: AsyncSession, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _prepare(db_session, tmp_path)
    svc = BackupService(db_session, settings_service=SettingService(db_session))

    async def _boom(_stmt):  # noqa: ANN001
        raise RuntimeError("no alembic_version")

    monkeypatch.setattr(db_session, "execute", _boom)
    # create will fail early on has_running / settings - only test helper
    assert await svc._alembic_current() == []


@pytest.mark.asyncio
async def test_soft_delete_missing_file_ok(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    await _prepare(db_session, tmp_path)
    row = SystemBackup(
        filename="gone.juman",
        storage_path="gone.juman",
        status=BackupStatus.COMPLETED.value,
        format_version=1,
        include_media=False,
    )
    db_session.add(row)
    await db_session.commit()
    svc = BackupService(db_session, settings_service=SettingService(db_session))
    deleted = await svc.soft_delete(row.id)
    assert deleted.status == BackupStatus.DELETED.value


def test_libpq_with_query() -> None:
    url, password = libpq_connection_parts(
        "postgresql+asyncpg://u:p@localhost:5432/db?sslmode=require"
    )
    assert password == "p"
    assert "sslmode=require" in url

