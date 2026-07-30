"""Fresh-install migration verification against juman_audit."""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

BACKEND = Path(__file__).resolve().parents[1]
URL = "postgresql+asyncpg://juman:juman@localhost:5432/juman_audit"


def run_alembic(*args: str) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["DATABASE_URL"] = URL
    env["APP_ENV"] = "testing"
    return subprocess.run(
        ["uv", "run", "alembic", *args],
        cwd=BACKEND,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


async def wipe_schema() -> None:
    engine = create_async_engine(URL)
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO juman"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
    await engine.dispose()


async def counts() -> dict:
    engine = create_async_engine(URL)
    out: dict = {}
    async with engine.connect() as conn:
        tables = (
            "settings",
            "permissions",
            "roles",
            "role_permissions",
            "barcode_counters",
            "alembic_version",
        )
        for table in tables:
            sql = "SELECT count(1) FROM " + table
            r = await conn.execute(text(sql))
            out[table] = int(r.scalar_one())
        r = await conn.execute(text("SELECT version_num FROM alembic_version"))
        out["head"] = r.scalar_one()
        r = await conn.execute(
            text(
                "SELECT count(1) FROM pg_indexes WHERE schemaname = 'public' "
                "AND indexdef ILIKE '%WHERE%'"
            )
        )
        out["partial_indexes"] = int(r.scalar_one())
        r = await conn.execute(
            text(
                "SELECT count(1) FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
            )
        )
        out["tables"] = int(r.scalar_one())
        r = await conn.execute(
            text(
                "SELECT count(1) FROM information_schema.table_constraints "
                "WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'"
            )
        )
        out["foreign_keys"] = int(r.scalar_one())
    await engine.dispose()
    return out


async def main() -> int:
    print("=== wipe schema ===")
    await wipe_schema()

    print("=== upgrade head (fresh) ===")
    p = run_alembic("upgrade", "head")
    print(p.stdout)
    print(p.stderr)
    if p.returncode != 0:
        return p.returncode

    print("=== heads ===")
    print(run_alembic("heads").stdout.strip())
    print("=== current ===")
    print(run_alembic("current").stdout.strip())

    c1 = await counts()
    print("COUNTS_AFTER_FRESH_UPGRADE", c1)

    print("=== re-upgrade head (idempotent) ===")
    p = run_alembic("upgrade", "head")
    print(p.stdout or "(noop)")
    c2 = await counts()
    print("COUNTS_AFTER_REUPGRADE", c2)
    assert c1 == c2, (c1, c2)

    print("=== downgrade to 20260726_0006_auth_engine ===")
    p = run_alembic("downgrade", "20260726_0006_auth_engine")
    print(p.stdout)
    print(p.stderr)
    if p.returncode != 0:
        print("DOWNGRADE_FAILED")
        return p.returncode

    print("=== upgrade head again ===")
    p = run_alembic("upgrade", "head")
    print(p.stdout)
    print(p.stderr)
    if p.returncode != 0:
        return p.returncode

    c3 = await counts()
    print("COUNTS_AFTER_ROUNDTRIP", c3)
    for key in ("settings", "permissions", "roles", "barcode_counters"):
        assert c3[key] == c1[key], (key, c1[key], c3[key])
    assert c3["head"] == c1["head"]

    print("=== attempt downgrade base (expect intentional block) ===")
    p = run_alembic("downgrade", "base")
    print("returncode", p.returncode)
    print((p.stderr or p.stdout)[-2000:])
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
