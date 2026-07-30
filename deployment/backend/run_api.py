"""Frozen entrypoint for juman-api.exe — wait for DB, then serve FastAPI; also supports migrate."""

from __future__ import annotations

import os
import sys
from pathlib import Path


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
    args = [a.lower() for a in (argv if argv is not None else sys.argv[1:])]
    if args and args[0] in ("migrate", "--migrate"):
        raise SystemExit(run_migrate())
    run_server()


if __name__ == "__main__":
    main()