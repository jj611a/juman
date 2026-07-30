"""Unit tests for restore validator and applier."""

from __future__ import annotations

import hashlib
import json
import sqlite3
import zipfile
from pathlib import Path
from unittest.mock import patch

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.exceptions import BusinessError
from app.modules.system_admin.constants import BACKUP_FORMAT
from app.modules.system_admin.services.restore_applier import (
    PostgresRestoreApplier,
    SqliteRestoreApplier,
)
from app.modules.system_admin.services.restore_validator import RestoreValidator


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _build_package(
    dest: Path,
    *,
    format_name: str = BACKUP_FORMAT,
    format_version: int = 1,
    engine: str = "sqlite",
    alembic: list[str] | None = None,
    app_version: str = "1.0.0",
    dump: bytes = b"SELECT 1;",
    corrupt_checksum: bool = False,
    omit_manifest: bool = False,
    bad_manifest_json: bool = False,
    empty_dump: bool = False,
    bad_checksum_line: bool = False,
    mismatch_manifest_hash: bool = False,
    mismatch_size: bool = False,
    empty_files: bool = False,
    bad_file_entry: bool = False,
    missing_path_in_files: bool = False,
    wrong_file_in_checksum: bool = False,
) -> Path:
    alembic = alembic if alembic is not None else ["20260731_0031_system_restores"]
    if empty_dump:
        dump = b""

    payload: dict[str, bytes] = {
        "metadata.json": b"{}",
        "database.dump": dump,
    }

    files_payload: list = []
    checksum_lines: list[str] = []
    for name, data in payload.items():
        digest = _sha(data)
        if name == "database.dump" and corrupt_checksum:
            digest = "0" * 64
        if wrong_file_in_checksum and name == "database.dump":
            checksum_lines.append(f"{digest}  missing-file.bin")
        elif bad_checksum_line and name == "database.dump":
            checksum_lines.append("only-one-token")
        else:
            checksum_lines.append(f"{digest}  {name}")

        if bad_file_entry and name == "database.dump":
            files_payload.append("bad")
        elif missing_path_in_files and name == "database.dump":
            files_payload.append({"sha256": digest})
        else:
            files_payload.append(
                {
                    "path": name,
                    "sha256": (
                        ("1" * 64)
                        if mismatch_manifest_hash and name == "database.dump"
                        else digest
                    ),
                    "size_bytes": (
                        0 if mismatch_size and name == "database.dump" else len(data)
                    ),
                }
            )

    if empty_files:
        files_payload = []

    members: dict[str, bytes] = dict(payload)
    if not omit_manifest:
        if bad_manifest_json:
            members["manifest.json"] = b"{not-json"
        else:
            manifest = {
                "format": format_name,
                "format_version": format_version,
                "app_version": app_version,
                "alembic_current": alembic,
                "alembic_head": alembic,
                "database_engine": engine,
                "include_media": False,
                "files": files_payload,
            }
            members["manifest.json"] = json.dumps(manifest, ensure_ascii=False).encode(
                "utf-8"
            )

    members["checksum.sha256"] = ("\n".join(checksum_lines) + "\n").encode("utf-8")

    with zipfile.ZipFile(dest, "w") as zf:
        for name, data in members.items():
            zf.writestr(name, data)
    return dest


def test_validator_ok_and_app_version_warning(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "ok.juman", app_version="0.9.0")
    result = RestoreValidator().validate_archive(
        pkg,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
        live_app_version="1.0.0",
    )
    assert result.ok is True
    assert result.warnings


def test_validator_missing_file(tmp_path: Path) -> None:
    result = RestoreValidator().validate_archive(
        tmp_path / "nope.juman",
        live_dialect="sqlite",
        live_alembic_current=["x"],
    )
    assert result.ok is False


def test_validator_expected_checksum(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "c.juman")
    result = RestoreValidator().validate_archive(
        pkg,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
        expected_checksum="0" * 64,
    )
    assert result.ok is False


def test_validator_bad_zip(tmp_path: Path) -> None:
    path = tmp_path / "bad.juman"
    path.write_bytes(b"not-a-zip")
    result = RestoreValidator().validate_archive(
        path, live_dialect="sqlite", live_alembic_current=["x"]
    )
    assert result.ok is False


def test_validator_omit_manifest(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "m.juman", omit_manifest=True)
    result = RestoreValidator().validate_archive(
        pkg,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
    )
    assert result.ok is False


def test_validator_bad_json(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "j.juman", bad_manifest_json=True)
    result = RestoreValidator().validate_archive(
        pkg,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
    )
    assert result.ok is False


def test_validator_unsupported_format(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "f.juman", format_name="other")
    result = RestoreValidator().validate_archive(
        pkg,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
    )
    assert result.ok is False


def test_validator_unsupported_version(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "v.juman", format_version=99)
    result = RestoreValidator().validate_archive(
        pkg,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
    )
    assert result.ok is False


def test_validator_empty_dump(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "e.juman", empty_dump=True)
    result = RestoreValidator().validate_archive(
        pkg,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
    )
    assert result.ok is False


def test_validator_corrupt_checksum(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "cc.juman", corrupt_checksum=True)
    result = RestoreValidator().validate_archive(
        pkg,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
    )
    assert result.ok is False


def test_validator_bad_checksum_line(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "bl.juman", bad_checksum_line=True)
    result = RestoreValidator().validate_archive(
        pkg,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
    )
    assert result.ok is False


def test_validator_missing_checksum_target(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "mf.juman", wrong_file_in_checksum=True)
    result = RestoreValidator().validate_archive(
        pkg,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
    )
    assert result.ok is False


def test_validator_empty_files(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "ef.juman", empty_files=True)
    result = RestoreValidator().validate_archive(
        pkg,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
    )
    assert result.ok is False


def test_validator_bad_file_entry(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "be.juman", bad_file_entry=True)
    result = RestoreValidator().validate_archive(
        pkg,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
    )
    assert result.ok is False


def test_validator_missing_path(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "mp.juman", missing_path_in_files=True)
    result = RestoreValidator().validate_archive(
        pkg,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
    )
    assert result.ok is False


def test_validator_mismatch_manifest_hash(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "mh.juman", mismatch_manifest_hash=True)
    result = RestoreValidator().validate_archive(
        pkg,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
    )
    assert result.ok is False


def test_validator_mismatch_size(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "ms.juman", mismatch_size=True)
    result = RestoreValidator().validate_archive(
        pkg,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
    )
    assert result.ok is False


def test_validator_cross_engine(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "ce.juman", engine="postgresql")
    result = RestoreValidator().validate_archive(
        pkg,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
    )
    assert result.ok is False


def test_validator_alembic_missing_and_mismatch(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "am.juman", alembic=[])
    result = RestoreValidator().validate_archive(
        pkg,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
    )
    assert result.ok is False
    pkg2 = _build_package(tmp_path / "am2.juman", alembic=["other"])
    result2 = RestoreValidator().validate_archive(
        pkg2,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
    )
    assert result2.ok is False


def test_validator_extract_package(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "ex.juman")
    dest = tmp_path / "out"
    dest.mkdir()
    (dest / "old.txt").write_text("x", encoding="utf-8")
    RestoreValidator().extract_package(pkg, dest)
    assert (dest / "manifest.json").is_file()


def test_validator_testzip_failure(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "tz.juman")
    with patch.object(zipfile.ZipFile, "testzip", return_value="database.dump"):
        result = RestoreValidator().validate_archive(
            pkg,
            live_dialect="sqlite",
            live_alembic_current=["20260731_0031_system_restores"],
        )
    assert result.ok is False


def test_validator_existing_extract_dir(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "exd.juman")
    leftover = pkg.parent / f".validate-{pkg.stem}"
    leftover.mkdir(parents=True, exist_ok=True)
    (leftover / "junk").write_text("x", encoding="utf-8")
    result = RestoreValidator().validate_archive(
        pkg,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
    )
    assert result.ok is True


def test_validator_manifest_missing_member(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "mm.juman")
    with zipfile.ZipFile(pkg, "r") as zf:
        data = {n: zf.read(n) for n in zf.namelist()}
    man = json.loads(data["manifest.json"])
    man["files"].append(
        {"path": "ghost.bin", "sha256": "a" * 64, "size_bytes": 1}
    )
    data["manifest.json"] = json.dumps(man).encode("utf-8")
    with zipfile.ZipFile(pkg, "w") as zf:
        for n, b in data.items():
            zf.writestr(n, b)
    result = RestoreValidator().validate_archive(
        pkg,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
    )
    assert result.ok is False

    pkg = tmp_path / "c.juman"
    with zipfile.ZipFile(pkg, "w") as zf:
        zf.writestr("a.txt", "hi")
    with patch.object(zipfile.ZipFile, "testzip", return_value="a.txt"):
        with pytest.raises(BusinessError):
            RestoreValidator().extract_package(pkg, tmp_path / "d")


def test_validator_blank_checksum_line_ok(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "blank.juman")
    with zipfile.ZipFile(pkg, "r") as zf:
        data = {n: zf.read(n) for n in zf.namelist()}
    data["checksum.sha256"] = b"\n" + data["checksum.sha256"]
    with zipfile.ZipFile(pkg, "w") as zf:
        for n, b in data.items():
            zf.writestr(n, b)
    result = RestoreValidator().validate_archive(
        pkg,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
    )
    assert result.ok is True


def test_validator_bad_format_version_type(tmp_path: Path) -> None:
    pkg = _build_package(tmp_path / "fv.juman")
    with zipfile.ZipFile(pkg, "r") as zf:
        data = {n: zf.read(n) for n in zf.namelist()}
    man = json.loads(data["manifest.json"])
    man["format_version"] = "not-int"
    data["manifest.json"] = json.dumps(man).encode("utf-8")
    with zipfile.ZipFile(pkg, "w") as zf:
        for n, b in data.items():
            zf.writestr(n, b)
    result = RestoreValidator().validate_archive(
        pkg,
        live_dialect="sqlite",
        live_alembic_current=["20260731_0031_system_restores"],
    )
    assert result.ok is False


@pytest.mark.asyncio
async def test_sqlite_applier_file(tmp_path: Path) -> None:
    db = tmp_path / "t.db"
    conn = sqlite3.connect(str(db))
    conn.execute("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)")
    conn.execute("INSERT INTO t (v) VALUES ('old')")
    conn.commit()
    conn.close()

    dump = tmp_path / "database.dump"
    dump.write_text(
        "BEGIN;\nCREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT);\n"
        "INSERT INTO t VALUES(1,'new');\nCOMMIT;\n",
        encoding="utf-8",
    )
    engine = create_async_engine(f"sqlite+aiosqlite:///{db.as_posix()}")
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        await SqliteRestoreApplier(session).apply(dump)
    conn = sqlite3.connect(str(db))
    assert conn.execute("SELECT v FROM t").fetchone()[0] == "new"
    conn.close()
    await engine.dispose()


@pytest.mark.asyncio
async def test_sqlite_applier_relative_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    db = Path("rel.db")
    conn = sqlite3.connect(str(db))
    conn.execute("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)")
    conn.commit()
    conn.close()
    dump = Path("database.dump")
    dump.write_text(
        "BEGIN;\nCREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT);\n"
        "INSERT INTO t VALUES(1,'rel');\nCOMMIT;\n",
        encoding="utf-8",
    )
    engine = create_async_engine("sqlite+aiosqlite:///rel.db")
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        await SqliteRestoreApplier(session).apply(dump)
    conn = sqlite3.connect(str(db))
    assert conn.execute("SELECT v FROM t").fetchone()[0] == "rel"
    conn.close()
    await engine.dispose()

    db = tmp_path / "t.db"
    sqlite3.connect(str(db)).close()
    engine = create_async_engine(f"sqlite+aiosqlite:///{db.as_posix()}")
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        with pytest.raises(BusinessError):
            await SqliteRestoreApplier(session).apply(tmp_path / "missing.dump")
    await engine.dispose()


@pytest.mark.asyncio
async def test_sqlite_applier_memory(tmp_path: Path) -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    dump = tmp_path / "database.dump"
    dump.write_text(
        "BEGIN;\nCREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT);\n"
        "INSERT INTO t VALUES(1,'mem');\nCOMMIT;\n",
        encoding="utf-8",
    )
    async with Session() as session:
        await session.execute(text("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)"))
        await session.commit()
        await SqliteRestoreApplier(session).apply(dump)
        rows = (await session.execute(text("SELECT v FROM t"))).all()
        assert rows[0][0] == "mem"
    await engine.dispose()


@pytest.mark.asyncio
async def test_postgres_applier_success(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    dump = tmp_path / "database.dump"
    dump.write_text("SELECT 1;", encoding="utf-8")
    monkeypatch.setattr(
        "app.modules.system_admin.services.restore_applier.shutil.which",
        lambda _: "psql",
    )
    monkeypatch.setattr(
        "app.modules.system_admin.services.restore_applier.libpq_connection_parts",
        lambda url: ("postgresql://u@localhost/db", "secret"),
    )

    class Completed:
        returncode = 0
        stdout = ""
        stderr = ""

    monkeypatch.setattr(
        "app.modules.system_admin.services.restore_applier.subprocess.run",
        lambda *a, **k: Completed(),
    )
    await PostgresRestoreApplier("postgresql+asyncpg://u:p@localhost/db").apply(dump)


@pytest.mark.asyncio
async def test_postgres_applier_missing_psql(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    dump = tmp_path / "database.dump"
    dump.write_text("SELECT 1;", encoding="utf-8")
    monkeypatch.setattr(
        "app.modules.system_admin.services.restore_applier.shutil.which",
        lambda _: None,
    )
    with pytest.raises(BusinessError):
        await PostgresRestoreApplier("postgresql+asyncpg://u:p@localhost/db").apply(dump)


@pytest.mark.asyncio
async def test_postgres_applier_nonzero(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    dump = tmp_path / "database.dump"
    dump.write_text("SELECT 1;", encoding="utf-8")
    monkeypatch.setattr(
        "app.modules.system_admin.services.restore_applier.shutil.which",
        lambda _: "psql",
    )
    monkeypatch.setattr(
        "app.modules.system_admin.services.restore_applier.libpq_connection_parts",
        lambda url: ("postgresql://u@localhost/db", None),
    )

    class Completed:
        returncode = 1
        stdout = ""
        stderr = "err"

    monkeypatch.setattr(
        "app.modules.system_admin.services.restore_applier.subprocess.run",
        lambda *a, **k: Completed(),
    )
    with pytest.raises(BusinessError):
        await PostgresRestoreApplier("postgresql+asyncpg://u:p@localhost/db").apply(dump)


@pytest.mark.asyncio
async def test_postgres_applier_timeout(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    import subprocess as sp

    dump = tmp_path / "database.dump"
    dump.write_text("SELECT 1;", encoding="utf-8")
    monkeypatch.setattr(
        "app.modules.system_admin.services.restore_applier.shutil.which",
        lambda _: "psql",
    )
    monkeypatch.setattr(
        "app.modules.system_admin.services.restore_applier.libpq_connection_parts",
        lambda url: ("postgresql://u@localhost/db", None),
    )

    def boom(*a, **k):
        raise sp.TimeoutExpired(cmd="psql", timeout=1)

    monkeypatch.setattr(
        "app.modules.system_admin.services.restore_applier.subprocess.run",
        boom,
    )
    with pytest.raises(BusinessError):
        await PostgresRestoreApplier("postgresql+asyncpg://u:p@localhost/db").apply(dump)


@pytest.mark.asyncio
async def test_postgres_applier_empty(tmp_path: Path) -> None:
    with pytest.raises(BusinessError):
        await PostgresRestoreApplier("postgresql+asyncpg://u:p@localhost/db").apply(
            tmp_path / "missing.dump"
        )
