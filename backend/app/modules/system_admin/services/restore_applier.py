"""Apply plain-SQL dumps for restore (Postgres psql / SQLite)."""

from __future__ import annotations

import os
import shutil
import sqlite3
import subprocess
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import BusinessError
from app.modules.system_admin.services.dumpers import libpq_connection_parts


class PostgresRestoreApplier:
    """Apply plain SQL via ``psql`` after resetting the public schema."""

    def __init__(self, database_url: str) -> None:
        self.database_url = database_url

    async def apply(self, dump_path: Path) -> None:
        if not dump_path.is_file() or dump_path.stat().st_size <= 0:
            raise BusinessError("ملف قاعدة البيانات مفقود أو فارغ")
        psql = shutil.which("psql")
        if not psql:
            raise BusinessError("أداة الاستعادة غير متوفرة")

        safe_url, password = libpq_connection_parts(self.database_url)
        env = os.environ.copy()
        if password is not None:
            env["PGPASSWORD"] = password

        reset = [
            psql,
            "--dbname",
            safe_url,
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;",
        ]
        apply_cmd = [
            psql,
            "--dbname",
            safe_url,
            "-v",
            "ON_ERROR_STOP=1",
            "-f",
            str(dump_path),
        ]
        try:
            for cmd in (reset, apply_cmd):
                completed = subprocess.run(
                    cmd,
                    check=False,
                    capture_output=True,
                    text=True,
                    env=env,
                    timeout=3600,
                )
                if completed.returncode != 0:
                    raise BusinessError("فشل تطبيق استعادة قاعدة البيانات")
        except subprocess.TimeoutExpired as exc:
            raise BusinessError("انتهت مهلة استعادة قاعدة البيانات") from exc


class SqliteRestoreApplier:
    """Replace SQLite database contents from an iterdump script (tests)."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def apply(self, dump_path: Path) -> None:
        if not dump_path.is_file() or dump_path.stat().st_size <= 0:
            raise BusinessError("ملف قاعدة البيانات مفقود أو فارغ")
        sql = dump_path.read_text(encoding="utf-8")
        bind = self.session.get_bind()
        database = bind.url.database
        await self.session.rollback()

        if database and database != ":memory:" and "mode=memory" not in str(bind.url):
            db_path = Path(database)
            if not db_path.is_absolute():
                db_path = Path.cwd() / db_path

            def _file_apply() -> None:
                conn = sqlite3.connect(str(db_path))
                try:
                    conn.execute("PRAGMA foreign_keys=OFF")
                    tables = conn.execute(
                        "SELECT name FROM sqlite_master "
                        "WHERE type='table' AND name NOT LIKE 'sqlite_%'"
                    ).fetchall()
                    for (name,) in tables:
                        conn.execute(f'DROP TABLE IF EXISTS "{name}"')
                    conn.executescript(sql)
                    conn.execute("PRAGMA foreign_keys=ON")
                    conn.commit()
                finally:
                    conn.close()

            _file_apply()
            self.session.expire_all()
            return

        connection = await self.session.connection()

        def _memory_apply(sync_conn) -> None:  # noqa: ANN001
            from sqlalchemy import text as sa_text

            sync_conn.execute(sa_text("PRAGMA foreign_keys=OFF"))
            rows = sync_conn.execute(
                sa_text(
                    "SELECT name FROM sqlite_master "
                    "WHERE type='table' AND name NOT LIKE 'sqlite_%'"
                )
            ).fetchall()
            for (name,) in rows:
                sync_conn.execute(sa_text(f'DROP TABLE IF EXISTS "{name}"'))
            # Prefer driver executescript when same-thread; else statement split.
            fairy = sync_conn.connection
            driver = getattr(fairy, "driver_connection", None) or fairy
            raw = getattr(driver, "_conn", None) or getattr(driver, "_connection", None)
            if raw is not None and hasattr(raw, "executescript"):
                try:
                    raw.executescript(sql)
                except Exception:  # noqa: BLE001
                    for stmt in sql.split(";"):
                        piece = stmt.strip()
                        if piece:
                            sync_conn.execute(sa_text(piece))
            else:
                for stmt in sql.split(";"):
                    piece = stmt.strip()
                    if piece:
                        sync_conn.execute(sa_text(piece))
            sync_conn.execute(sa_text("PRAGMA foreign_keys=ON"))

        await connection.run_sync(_memory_apply)
        await self.session.commit()
        self.session.expire_all()