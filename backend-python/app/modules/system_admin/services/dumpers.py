"""Database dump adapters for backup packages."""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import Protocol
from urllib.parse import unquote, urlparse

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import BusinessError


class BackupDumper(Protocol):
    """Protocol for producing a plain-SQL database.dump."""

    engine_name: str

    async def dump(self, target: Path) -> str:
        """Write dump to ``target``; return tool identity string for metadata."""
        ...


def libpq_connection_parts(database_url: str) -> tuple[str, str | None]:
    """
    Convert SQLAlchemy DSN to a libpq URL and optional password.

    Password is returned separately for PGPASSWORD; never log either value.
    """
    normalized = database_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    normalized = normalized.replace("postgres+asyncpg://", "postgresql://", 1)
    parsed = urlparse(normalized)
    password = unquote(parsed.password) if parsed.password else None
    host = parsed.hostname or "localhost"
    port = parsed.port or 5432
    user = unquote(parsed.username) if parsed.username else "postgres"
    db = (parsed.path or "/").lstrip("/") or "postgres"
    # Rebuild without password in the URL string passed to argv.
    safe_url = f"postgresql://{user}@{host}:{port}/{db}"
    if parsed.query:
        safe_url = f"{safe_url}?{parsed.query}"
    return safe_url, password


def resolve_pg_dump() -> str | None:
    """Locate ``pg_dump`` on PATH, via ``PG_DUMP``, or common install dirs."""
    explicit = os.environ.get("PG_DUMP") or os.environ.get("PGDUMP")
    if explicit and Path(explicit).is_file():
        return str(Path(explicit))

    which = shutil.which("pg_dump")
    if which:
        return which

    candidates: list[Path] = [
        Path(r"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"),
        Path(r"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"),
        Path(r"C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"),
        Path("/usr/bin/pg_dump"),
        Path("/usr/local/bin/pg_dump"),
        Path("/opt/homebrew/bin/pg_dump"),
    ]
    program_files = Path(r"C:\Program Files\PostgreSQL")
    if program_files.is_dir():
        for version_dir in sorted(program_files.iterdir(), reverse=True):
            candidates.append(version_dir / "bin" / "pg_dump.exe")

    for path in candidates:
        if path.is_file():
            return str(path)
    return None


class PostgresDumper:
    """Dump via ``pg_dump`` plain SQL (no owner/ACL)."""

    engine_name = "postgresql"

    def __init__(self, database_url: str) -> None:
        self.database_url = database_url

    async def dump(self, target: Path) -> str:
        pg_dump = resolve_pg_dump()
        if not pg_dump:
            raise BusinessError("أداة النسخ الاحتياطي غير متوفرة")

        safe_url, password = libpq_connection_parts(self.database_url)
        env = os.environ.copy()
        if password is not None:
            env["PGPASSWORD"] = password

        cmd = [
            pg_dump,
            "--no-owner",
            "--no-acl",
            "--format=plain",
            "--file",
            str(target),
            safe_url,
        ]
        try:
            completed = subprocess.run(
                cmd,
                check=False,
                capture_output=True,
                text=True,
                env=env,
                timeout=3600,
            )
        except subprocess.TimeoutExpired as exc:
            raise BusinessError("انتهت مهلة إنشاء نسخة قاعدة البيانات") from exc

        if completed.returncode != 0:
            raise BusinessError("فشل إنشاء نسخة قاعدة البيانات")

        version = "pg_dump"
        try:
            ver = subprocess.run(
                [pg_dump, "--version"],
                check=False,
                capture_output=True,
                text=True,
                timeout=10,
            )
            if ver.returncode == 0 and ver.stdout.strip():
                version = ver.stdout.strip().splitlines()[0]
        except Exception:  # noqa: BLE001
            pass
        return version


class SqliteDumper:
    """Dump via sqlite3 `iterdump` (tests / SQLite)."""

    engine_name = "sqlite"

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def dump(self, target: Path) -> str:
        bind = self.session.get_bind()
        database = bind.url.database
        if database and database != ":memory:" and "mode=memory" not in str(bind.url):
            # Prefer a separate sync connection so we do not disturb the
            # SQLAlchemy/aiosqlite greenlet owning the session connection.
            db_path = Path(database)
            if not db_path.is_absolute():
                db_path = Path.cwd() / db_path

            def _file_dump() -> None:
                import sqlite3

                conn = sqlite3.connect(str(db_path))
                try:
                    with target.open("w", encoding="utf-8", newline="\n") as handle:
                        for line in conn.iterdump():
                            handle.write(f"{line}\n")
                finally:
                    conn.close()

            _file_dump()
            if not target.is_file() or target.stat().st_size <= 0:
                raise BusinessError("فشل إنشاء نسخة قاعدة البيانات")
            return "sqlite-iterdump"

        # In-memory fallback: async aiosqlite iterdump on the live connection.
        connection = await self.session.connection()
        raw = await connection.get_raw_connection()
        driver = getattr(raw, "driver_connection", None) or raw
        lines: list[str] = []
        result = driver.iterdump()
        if hasattr(result, "__aiter__"):
            async for line in result:
                lines.append(str(line))
        else:
            lines.extend(str(line) for line in result)
        if not lines:
            lines = ["BEGIN TRANSACTION;", "COMMIT;"]
        target.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return "sqlite-iterdump"
