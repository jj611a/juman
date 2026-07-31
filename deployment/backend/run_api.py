"""Frozen entrypoint for juman-api.exe — wait for DB, then serve FastAPI; also supports migrate/diagnose."""

from __future__ import annotations

import json
import os
import sys
import time
import traceback
from pathlib import Path
from urllib.parse import urlparse


def _load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, _, value = raw.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def _resolve_install_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent.parent
    return Path(__file__).resolve().parents[2]


def _bundle_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return Path(__file__).resolve().parents[2] / "backend"


def _prepare_env(root: Path) -> None:
    os.environ.setdefault("JUMAN_INSTALL_DIR", str(root))
    _load_env_file(root / "config" / "juman.env")
    storage = root / "storage"
    storage.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("MEDIA_STORAGE_ROOT", str(storage))
    (root / "logs").mkdir(parents=True, exist_ok=True)


def _alembic_url(dsn: str) -> str:
    if "+asyncpg" in dsn:
        return dsn.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
    return dsn


def _sync_dsn(dsn: str) -> str:
    url = _alembic_url(dsn)
    return url.replace("postgresql+psycopg://", "postgresql://", 1)


def _alembic_heads(bundle: Path) -> list[str]:
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    ini = bundle / "alembic.ini"
    cfg = Config(str(ini))
    cfg.set_main_option("script_location", str(bundle / "alembic"))
    script = ScriptDirectory.from_config(cfg)
    return sorted(script.get_heads())


def run_diagnose(root: Path | None = None) -> int:
    """Read-only machine diagnostics as a single JSON object on stdout."""
    root = root or _resolve_install_root()
    _prepare_env(root)
    bundle = _bundle_root()
    dsn = os.environ.get("DATABASE_URL", "")
    result: dict[str, object] = {
        "ok": False,
        "installRoot": str(root),
        "connectionOk": False,
        "databaseExists": None,
        "userExists": None,
        "schemaVersion": None,
        "alembicHead": None,
        "migrationHistory": None,
        "migrationStatus": None,
        "pendingMigrations": None,
        "upgradePossible": None,
        "latencyMs": None,
        "error": None,
        "exception": None,
        "appVersion": None,
    }

    try:
        from app import __version__ as app_version

        result["appVersion"] = app_version
    except Exception:  # noqa: BLE001
        result["appVersion"] = os.environ.get("APP_VERSION")

    if not dsn:
        result["error"] = "DATABASE_URL missing — configure config\\juman.env"
        print(json.dumps(result, ensure_ascii=False))
        return 2

    try:
        heads = _alembic_heads(bundle)
        result["alembicHead"] = heads[0] if len(heads) == 1 else heads
        result["upgradePossible"] = True
    except Exception as exc:  # noqa: BLE001
        result["alembicHead"] = None
        result["upgradePossible"] = None
        result["error"] = f"alembic heads failed: {exc}"
        result["exception"] = traceback.format_exc()

    try:
        import psycopg

        sync = _sync_dsn(dsn)
        parsed = urlparse(sync.replace("postgresql://", "http://", 1))
        db_name = (parsed.path or "").lstrip("/") or None
        user = parsed.username

        t0 = time.perf_counter()
        with psycopg.connect(sync, connect_timeout=8) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
                latency_ms = round((time.perf_counter() - t0) * 1000, 2)
                result["latencyMs"] = latency_ms
                result["connectionOk"] = True
                result["databaseExists"] = True
                result["userExists"] = bool(user)

                try:
                    cur.execute(
                        "SELECT version_num FROM alembic_version ORDER BY version_num"
                    )
                    rows = [r[0] for r in cur.fetchall()]
                    result["migrationHistory"] = rows
                    result["schemaVersion"] = rows[-1] if rows else None
                except Exception as exc:  # noqa: BLE001
                    result["migrationStatus"] = f"alembic_version unread: {exc}"
                    result["exception"] = traceback.format_exc()

                if result.get("schemaVersion") and result.get("alembicHead"):
                    head = result["alembicHead"]
                    head_s = head[0] if isinstance(head, list) else head
                    pending = result["schemaVersion"] != head_s
                    result["pendingMigrations"] = pending
                    result["migrationStatus"] = "pending" if pending else "up_to_date"
                elif result.get("connectionOk"):
                    result["migrationStatus"] = result.get("migrationStatus") or "unknown"

                if db_name:
                    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
                    result["databaseExists"] = cur.fetchone() is not None
                if user:
                    cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (user,))
                    result["userExists"] = cur.fetchone() is not None

        result["ok"] = True
    except Exception as exc:  # noqa: BLE001
        result["connectionOk"] = False
        result["error"] = str(exc)
        result["exception"] = traceback.format_exc()
        print(json.dumps(result, ensure_ascii=False))
        return 1

    print(json.dumps(result, ensure_ascii=False))
    return 0 if result.get("ok") else 1


def run_migrate(root: Path | None = None) -> int:
    """Run alembic upgrade head (no business-logic changes)."""
    root = root or _resolve_install_root()
    _prepare_env(root)
    dsn = os.environ.get("DATABASE_URL", "")
    if not dsn:
        print("DATABASE_URL missing — configure config\\juman.env", file=sys.stderr)
        return 2

    from alembic import command
    from alembic.config import Config

    bundle = _bundle_root()
    ini = bundle / "alembic.ini"
    if not ini.is_file():
        print(f"alembic.ini not found at {ini}", file=sys.stderr)
        return 3

    cfg = Config(str(ini))
    cfg.set_main_option("script_location", str(bundle / "alembic"))
    cfg.set_main_option("sqlalchemy.url", _alembic_url(dsn))
    command.upgrade(cfg, "head")
    print("alembic upgrade head: ok")
    return 0


def run_server(root: Path | None = None) -> None:
    root = root or _resolve_install_root()
    _prepare_env(root)
    dsn = os.environ.get("DATABASE_URL", "")
    if not dsn:
        print("DATABASE_URL missing — configure config\\juman.env", file=sys.stderr)
        raise SystemExit(2)

    from wait_for_db import wait_for_db

    wait_for_db(dsn, timeout_sec=float(os.environ.get("JUMAN_DB_WAIT_TIMEOUT", "180")))

    import uvicorn
    from app.main import create_app

    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    app = create_app()
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level=os.environ.get("LOG_LEVEL", "info").lower(),
    )


def main(argv: list[str] | None = None) -> None:
    raw = list(argv if argv is not None else sys.argv[1:])
    args = [a.lower() for a in raw]
    if args and args[0] in ("migrate", "--migrate"):
        raise SystemExit(run_migrate())
    if args and args[0] in ("diagnose", "--diagnose"):
        # optional --json is accepted for callers; output is always JSON
        raise SystemExit(run_diagnose())
    run_server()


if __name__ == "__main__":
    main()
