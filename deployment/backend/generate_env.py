"""Generate config/juman.env for a Windows install (pure helpers; unit-tested)."""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote_plus


@dataclass(frozen=True)
class EnvGenInput:
    install_root: Path
    db_host: str = "127.0.0.1"
    db_port: int = 5432
    db_name: str = "juman"
    db_user: str = "juman"
    db_password: str = "juman"
    secret_key: str = "change-me-in-production"
    bootstrap_username: str = "admin"
    bootstrap_password: str = "Admin123!"
    company_name: str = "Juman"
    timezone: str = "Asia/Baghdad"
    language: str = "ar"
    app_env: str = "production"
    port: int = 8000


def build_database_url(inp: EnvGenInput) -> str:
    user = quote_plus(inp.db_user)
    password = quote_plus(inp.db_password)
    return (
        f"postgresql+asyncpg://{user}:{password}"
        f"@{inp.db_host}:{inp.db_port}/{inp.db_name}"
    )


def render_juman_env(inp: EnvGenInput) -> str:
    storage = inp.install_root / "storage"
    lines = [
        "APP_NAME=Juman",
        f"APP_ENV={inp.app_env}",
        "APP_DEBUG=false",
        f"SECRET_KEY={inp.secret_key}",
        "HOST=127.0.0.1",
        f"PORT={inp.port}",
        f"DATABASE_URL={build_database_url(inp)}",
        f"MEDIA_STORAGE_ROOT={storage.as_posix()}",
        f"IDENTITY_BOOTSTRAP_USERNAME={inp.bootstrap_username}",
        f"IDENTITY_BOOTSTRAP_PASSWORD={inp.bootstrap_password}",
        f"JUMAN_COMPANY_NAME={inp.company_name}",
        f"JUMAN_TIMEZONE={inp.timezone}",
        f"JUMAN_LANGUAGE={inp.language}",
        f"JUMAN_INSTALL_DIR={inp.install_root.as_posix()}",
        "JUMAN_DB_WAIT_TIMEOUT=180",
        "LOG_LEVEL=INFO",
        "LOG_JSON=false",
    ]
    return "\n".join(lines) + "\n"


def write_juman_env(inp: EnvGenInput, path: Path | None = None) -> Path:
    target = path or (inp.install_root / "config" / "juman.env")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(render_juman_env(inp), encoding="utf-8")
    return target


def patch_juman_env(path: Path, updates: dict[str, str]) -> Path:
    """Update or append keys in an existing env file."""
    existing: dict[str, str] = {}
    order: list[str] = []
    if path.is_file():
        for line in path.read_text(encoding="utf-8").splitlines():
            raw = line.strip()
            if not raw or raw.startswith("#") or "=" not in raw:
                continue
            key, _, value = raw.partition("=")
            key = key.strip()
            if key not in existing:
                order.append(key)
            existing[key] = value.strip()
    for key, value in updates.items():
        if key not in existing:
            order.append(key)
        existing[key] = value
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(f"{k}={existing[k]}\n" for k in order), encoding="utf-8")
    return path


def uninstall_should_drop_database(retain_database: bool) -> bool:
    """Pure policy helper for NSIS / uninstaller scripts."""
    return not retain_database


def uninstall_should_preserve_storage(retain_storage: bool) -> bool:
    return retain_storage


def generate_install_secrets() -> dict[str, str]:
    return {
        "secret_key": secrets.token_urlsafe(32),
        "db_password": secrets.token_urlsafe(18),
        "bootstrap_password": secrets.token_urlsafe(12),
        "pg_super_password": secrets.token_urlsafe(18),
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--db-password", default=None)
    parser.add_argument("--bootstrap-password", default=None)
    parser.add_argument("--secret-key", default=None)
    parser.add_argument("--company", default="Juman")
    parser.add_argument("--timezone", default="Asia/Baghdad")
    parser.add_argument("--language", default="ar")
    args = parser.parse_args()
    secrets_map = generate_install_secrets()
    out = write_juman_env(
        EnvGenInput(
            install_root=args.root,
            db_password=args.db_password or secrets_map["db_password"],
            bootstrap_password=args.bootstrap_password or secrets_map["bootstrap_password"],
            company_name=args.company,
            timezone=args.timezone,
            language=args.language,
            secret_key=args.secret_key or secrets_map["secret_key"],
        )
    )
    print(out)
