"""Unit tests for backup package builder and dumpers."""

from __future__ import annotations

import zipfile
from pathlib import Path
from uuid import uuid4

import pytest
from app.exceptions import BusinessError
from app.modules.system_admin.services.backup_package import (
    BackupPackageBuilder,
    PackageBuildContext,
    confined_path,
    resolve_storage_root,
    sha256_file,
)
from app.modules.system_admin.services.dumpers import (
    SqliteDumper,
    libpq_connection_parts,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.database.base import Base
from app.modules.settings.models import Setting  # noqa: F401
from app.modules.system_admin.models import SystemBackup  # noqa: F401
from app.modules.audit.models import AuditLog  # noqa: F401
from app.modules.identity.models import User  # noqa: F401
from app.modules.rbac.models import Role  # noqa: F401


def test_libpq_strips_password() -> None:
    url, password = libpq_connection_parts(
        "postgresql+asyncpg://alice:s3cret@db.example:5433/juman"
    )
    assert password == "s3cret"
    assert "s3cret" not in url
    assert url.startswith("postgresql://alice@db.example:5433/juman")


def test_resolve_and_confine(tmp_path: Path) -> None:
    root = resolve_storage_root(tmp_path / "backups")
    assert root.is_dir()
    target = confined_path(root, "a.juman")
    assert target.parent == root
    with pytest.raises(BusinessError):
        confined_path(root, "../escape.juman")


@pytest.mark.asyncio
async def test_sqlite_dumper_and_package(tmp_path: Path) -> None:
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'db.sqlite'}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with factory() as session:
        dumper = SqliteDumper(session)
        dump_path = tmp_path / "database.dump"
        tool = await dumper.dump(dump_path)
        assert tool == "sqlite-iterdump"
        assert dump_path.stat().st_size > 0

        builder = BackupPackageBuilder(tmp_path / "out")
        built = await builder.build(
            dumper=dumper,
            context=PackageBuildContext(
                app_version="0.0.0-test",
                alembic_head=["head"],
                alembic_current=["cur"],
                created_by=uuid4(),
                database_engine="sqlite",
                database_name="db.sqlite",
                default_timezone="UTC",
                hostname="host",
                python_version="3.11",
                operating_system="test",
                notes=None,
                include_media=False,
                media_root=None,
            ),
        )
        assert built.absolute_path.is_file()
        assert built.checksum_sha256 == sha256_file(built.absolute_path)
        with zipfile.ZipFile(built.absolute_path, "r") as zf:
            assert "manifest.json" in zf.namelist()
            assert zf.testzip() is None
    await engine.dispose()


@pytest.mark.asyncio
async def test_package_include_media_missing_fails(tmp_path: Path) -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with factory() as session:
        builder = BackupPackageBuilder(tmp_path / "out")
        with pytest.raises(BusinessError):
            await builder.build(
                dumper=SqliteDumper(session),
                context=PackageBuildContext(
                    app_version="0.0.0-test",
                    alembic_head=[],
                    alembic_current=[],
                    created_by=None,
                    database_engine="sqlite",
                    database_name=":memory:",
                    default_timezone="UTC",
                    hostname="host",
                    python_version="3.11",
                    operating_system="test",
                    notes=None,
                    include_media=True,
                    media_root=tmp_path / "missing-media",
                ),
            )
    await engine.dispose()


@pytest.mark.asyncio
async def test_empty_dump_fails(tmp_path: Path) -> None:
    class EmptyDumper:
        engine_name = "sqlite"

        async def dump(self, target: Path) -> str:
            target.write_text("", encoding="utf-8")
            return "empty"

    builder = BackupPackageBuilder(tmp_path / "out")
    with pytest.raises(BusinessError):
        await builder.build(
            dumper=EmptyDumper(),
            context=PackageBuildContext(
                app_version="0",
                alembic_head=[],
                alembic_current=[],
                created_by=None,
                database_engine="sqlite",
                database_name=":memory:",
                default_timezone="UTC",
                hostname="h",
                python_version="3",
                operating_system="t",
                notes=None,
                include_media=False,
                media_root=None,
            ),
        )
