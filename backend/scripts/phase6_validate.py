"""Phase 6 production validation orchestrator."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from scripts.phase6_db import (  # noqa: E402
    create_validation_database,
    drop_validation_database,
    parse_database_name,
)

EXPECTED_HEAD = "20260802_0033_system_backups_duration"
BOUNDED_DOWNGRADE_TARGET = "20260726_0006_auth_engine"
OUT_DIR = BACKEND / ".phase6"


def _run(cmd: list[str], *, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    merged = os.environ.copy()
    if env:
        merged.update(env)
    return subprocess.run(
        cmd,
        cwd=BACKEND,
        env=merged,
        capture_output=True,
        text=True,
        check=False,
    )


def _alembic(database_url: str, *args: str) -> None:
    env = {
        "DATABASE_URL": database_url,
        "APP_ENV": "testing",
        "SECRET_KEY": os.environ.get("SECRET_KEY", "phase6-validation-secret-key-32chars-min"),
        "REDIS_ENABLED": "false",
    }
    proc = _run([sys.executable, "-m", "alembic", *args], env=env)
    if proc.returncode != 0:
        raise RuntimeError(
            f"alembic {' '.join(args)} failed:\n{proc.stdout}\n{proc.stderr}"
        )


async def _schema_snapshot(database_url: str) -> dict[str, Any]:
    engine = create_async_engine(database_url)
    out: dict[str, Any] = {}
    try:
        async with engine.connect() as conn:
            out["alembic_version"] = (
                await conn.execute(text("SELECT version_num FROM alembic_version"))
            ).scalar_one()
            out["tables"] = int(
                (
                    await conn.execute(
                        text(
                            "SELECT count(*) FROM information_schema.tables "
                            "WHERE table_schema='public' AND table_type='BASE TABLE'"
                        )
                    )
                ).scalar_one()
            )
            out["foreign_keys"] = int(
                (
                    await conn.execute(
                        text(
                            "SELECT count(*) FROM information_schema.table_constraints "
                            "WHERE constraint_type='FOREIGN KEY' AND table_schema='public'"
                        )
                    )
                ).scalar_one()
            )
            out["partial_indexes"] = int(
                (
                    await conn.execute(
                        text(
                            "SELECT count(*) FROM pg_indexes "
                            "WHERE schemaname='public' AND indexdef ILIKE '%WHERE%'"
                        )
                    )
                ).scalar_one()
            )
            out["settings"] = int(
                (
                    await conn.execute(
                        text("SELECT count(*) FROM settings WHERE is_deleted = false")
                    )
                ).scalar_one()
            )
            out["permissions"] = int(
                (
                    await conn.execute(
                        text("SELECT count(*) FROM permissions WHERE is_deleted = false")
                    )
                ).scalar_one()
            )
            out["system_permissions"] = int(
                (
                    await conn.execute(
                        text(
                            "SELECT count(*) FROM permissions "
                            "WHERE key LIKE 'system.%' AND is_deleted = false"
                        )
                    )
                ).scalar_one()
            )
    finally:
        await engine.dispose()
    return out


def _scan_irreversible_migrations() -> list[str]:
    versions = BACKEND / "alembic" / "versions"
    found: list[str] = []
    for path in versions.glob("*.py"):
        text_body = path.read_text(encoding="utf-8", errors="ignore")
        if "NotImplementedError" in text_body and "def downgrade" in text_body:
            found.append(path.name)
    return sorted(found)


async def run_validation(*, keep_db: bool, skip_layer1: bool, skip_layer2: bool) -> dict[str, Any]:
    admin_url = os.environ.get(
        "DATABASE_ADMIN_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres",
    )
    app_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://juman:juman@localhost:5432/juman",
    )
    app_env = os.environ.get("APP_ENV", "development")
    if app_env == "production" and os.environ.get("JUMAN_PHASE6_ALLOW_PRODUCTION") != "1":
        raise RuntimeError(
            "Refusing to run Phase 6 when APP_ENV=production "
            "(set JUMAN_PHASE6_ALLOW_PRODUCTION=1 to override)"
        )

    summary: dict[str, Any] = {
        "started_at": datetime.now(UTC).isoformat(),
        "expected_head": EXPECTED_HEAD,
        "admin_url_host": admin_url.split("@")[-1],
        "app_database": parse_database_name(app_url),
        "irreversible_migrations": _scan_irreversible_migrations(),
        "layers": {},
        "ok": False,
    }

    validation = await create_validation_database(admin_url=admin_url, app_database_url=app_url)
    summary["validation_database"] = validation.name
    summary["validation_url_db"] = parse_database_name(validation.app_url)
    print(f"[phase6] created {validation.name}")

    try:
        os.environ["DATABASE_URL"] = validation.app_url
        os.environ["APP_ENV"] = "testing"

        print("[phase6] alembic upgrade head (fresh)")
        _alembic(validation.app_url, "upgrade", "head")
        snap = await _schema_snapshot(validation.app_url)
        summary["fresh_install"] = snap
        if snap["alembic_version"] != EXPECTED_HEAD:
            raise RuntimeError(f"Expected head {EXPECTED_HEAD}, got {snap['alembic_version']}")
        if snap["system_permissions"] < 4:
            raise RuntimeError("system.* permissions not seeded")
        if snap["settings"] < 1:
            raise RuntimeError("settings not seeded")

        print("[phase6] alembic upgrade head (idempotent)")
        _alembic(validation.app_url, "upgrade", "head")
        snap2 = await _schema_snapshot(validation.app_url)
        if snap2 != snap:
            raise RuntimeError(f"Idempotent upgrade drifted schema snapshot: {snap} vs {snap2}")
        summary["idempotent_upgrade"] = "ok"

        print(f"[phase6] bounded downgrade to {BOUNDED_DOWNGRADE_TARGET}")
        _alembic(validation.app_url, "downgrade", BOUNDED_DOWNGRADE_TARGET)
        summary["bounded_downgrade"] = "ok"

        print("[phase6] upgrade head after bounded downgrade")
        _alembic(validation.app_url, "upgrade", "head")
        snap3 = await _schema_snapshot(validation.app_url)
        summary["after_roundtrip"] = snap3
        if snap3["alembic_version"] != EXPECTED_HEAD:
            raise RuntimeError("Round-trip did not restore HEAD")

        env = {
            "DATABASE_URL": validation.app_url,
            "JUMAN_POSTGRES_CERT": "1",
            "APP_ENV": "testing",
            "SECRET_KEY": os.environ.get(
                "SECRET_KEY", "phase6-validation-secret-key-32chars-min"
            ),
            "REDIS_ENABLED": "false",
        }

        if not skip_layer2:
            print("[phase6] Layer 2 postgres_cert")
            p2 = _run(
                [
                    sys.executable,
                    "-m",
                    "pytest",
                    "tests/postgres_cert",
                    "-q",
                    "--tb=short",
                ],
                env=env,
            )
            summary["layers"]["postgres_cert"] = {
                "returncode": p2.returncode,
                "stdout_tail": p2.stdout[-4000:],
                "stderr_tail": p2.stderr[-2000:],
            }
            print(p2.stdout)
            if p2.returncode != 0:
                print(p2.stderr)
                raise RuntimeError("Layer 2 postgres_cert failed")

        if not skip_layer1:
            print("[phase6] Layer 1 full pytest + coverage")
            p1 = _run(
                [
                    sys.executable,
                    "-m",
                    "pytest",
                    "-q",
                    "--tb=line",
                    "--cov=app",
                    "--cov-report=term-missing:skip-covered",
                    "--ignore=tests/postgres_cert",
                ],
                env={
                    "APP_ENV": "testing",
                    "REDIS_ENABLED": "false",
                    "SECRET_KEY": env["SECRET_KEY"],
                    "DATABASE_URL": app_url,
                },
            )
            summary["layers"]["pytest_sqlite"] = {
                "returncode": p1.returncode,
                "stdout_tail": p1.stdout[-6000:],
                "stderr_tail": p1.stderr[-2000:],
            }
            print(p1.stdout[-3000:] if p1.stdout else "")
            if p1.returncode != 0:
                print(p1.stderr)
                raise RuntimeError("Layer 1 pytest failed")

        summary["ok"] = True
        summary["finished_at"] = datetime.now(UTC).isoformat()
        return summary
    finally:
        if keep_db:
            print(f"[phase6] keeping validation database {validation.name}")
        else:
            print(f"[phase6] dropping {validation.name}")
            await drop_validation_database(admin_url=admin_url, name=validation.name)


def main() -> int:
    parser = argparse.ArgumentParser(description="Juman Backend Phase 6 validation")
    parser.add_argument("--keep-validation-db", action="store_true")
    parser.add_argument("--skip-layer1", action="store_true")
    parser.add_argument("--skip-layer2", action="store_true")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    try:
        summary = asyncio.run(
            run_validation(
                keep_db=args.keep_validation_db
                or os.environ.get("JUMAN_KEEP_VALIDATION_DB") == "1",
                skip_layer1=args.skip_layer1,
                skip_layer2=args.skip_layer2,
            )
        )
    except Exception as exc:  # noqa: BLE001
        summary = {
            "ok": False,
            "error": str(exc),
            "finished_at": datetime.now(UTC).isoformat(),
            "irreversible_migrations": _scan_irreversible_migrations(),
        }
        print(f"[phase6] FAILED: {exc}")
        (OUT_DIR / "last_run.json").write_text(
            json.dumps(summary, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        return 1

    (OUT_DIR / "last_run.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print("[phase6] PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
