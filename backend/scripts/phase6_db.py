"""Utilities for Phase 6 isolated PostgreSQL validation databases."""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse, urlunparse
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

SAFE_DB_NAME = re.compile(r"^juman_validation_[0-9a-f]{8,32}$")
FORBIDDEN_NAMES = {"postgres", "template0", "template1", "juman", "juman_test", "juman_audit"}


@dataclass(frozen=True, slots=True)
class ValidationDatabase:
    name: str
    admin_url: str
    app_url: str


def parse_database_name(database_url: str) -> str:
    parsed = urlparse(database_url.replace("postgresql+asyncpg://", "postgresql://", 1))
    name = (parsed.path or "").lstrip("/").split("?")[0]
    return name


def swap_database_name(database_url: str, new_name: str) -> str:
    raw = database_url
    scheme = "postgresql+asyncpg"
    if raw.startswith("postgresql+asyncpg://"):
        normalized = "postgresql://" + raw[len("postgresql+asyncpg://") :]
    elif raw.startswith("postgresql://"):
        scheme = "postgresql"
        normalized = raw
    else:
        raise ValueError("DATABASE_ADMIN_URL must be a postgresql(+asyncpg) URL")
    parsed = urlparse(normalized)
    rebuilt = parsed._replace(path=f"/{new_name}")
    out = urlunparse(rebuilt)
    if scheme == "postgresql+asyncpg":
        out = "postgresql+asyncpg://" + out[len("postgresql://") :]
    return out


def build_validation_name() -> str:
    return f"juman_validation_{uuid4().hex[:16]}"


def assert_safe_validation_name(name: str, *, app_database_name: str | None) -> None:
    if name in FORBIDDEN_NAMES:
        raise RuntimeError(f"Refusing to use forbidden database name: {name}")
    if app_database_name and name == app_database_name:
        raise RuntimeError("Validation database name collides with application DATABASE_URL")
    if not SAFE_DB_NAME.match(name):
        raise RuntimeError(f"Unsafe validation database name: {name}")


async def create_validation_database(
    *,
    admin_url: str,
    app_database_url: str,
    owner: str = "juman",
    keep_name: str | None = None,
) -> ValidationDatabase:
    app_name = parse_database_name(app_database_url)
    name = keep_name or build_validation_name()
    assert_safe_validation_name(name, app_database_name=app_name)
    engine = create_async_engine(admin_url, isolation_level="AUTOCOMMIT")
    try:
        async with engine.connect() as conn:
            await conn.execute(text(f'CREATE DATABASE "{name}" OWNER "{owner}"'))
    finally:
        await engine.dispose()
    return ValidationDatabase(
        name=name,
        admin_url=admin_url,
        app_url=swap_database_name(app_database_url, name),
    )


async def drop_validation_database(*, admin_url: str, name: str) -> None:
    assert_safe_validation_name(name, app_database_name=None)
    engine = create_async_engine(admin_url, isolation_level="AUTOCOMMIT")
    try:
        async with engine.connect() as conn:
            await conn.execute(
                text(
                    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                    "WHERE datname = :name AND pid <> pg_backend_pid()"
                ),
                {"name": name},
            )
            await conn.execute(text(f'DROP DATABASE IF EXISTS "{name}"'))
    finally:
        await engine.dispose()
