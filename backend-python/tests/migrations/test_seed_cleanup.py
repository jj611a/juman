"""
Regression tests for Alembic downgrade seed-cleanup.

Several migrations seed reference data (settings, permissions, barcode
counters) during `upgrade()`. Before this fix, their `downgrade()` methods
dropped the schema objects they created but left the seeded rows behind,
making the migration chain non-reversible: `upgrade -> downgrade -> upgrade`
would silently duplicate or drift seed data.

These tests exercise a real downgrade/upgrade round trip against the
Postgres test database and confirm that every seed introduced by the
affected migrations disappears on downgrade and is cleanly restored on
the following upgrade. They are skipped automatically when the Postgres
test database is unreachable (e.g. a machine without a local Postgres
instance) since module-level unit tests do not require Postgres.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

BACKEND_DIR = Path(__file__).resolve().parents[2]
TARGET_REVISION = "20260726_0006_auth_engine"

SETTING_KEY_PATTERNS: tuple[str, ...] = (
    "reservations.number.%",
    "rentals.number.%",
    "returns.number.%",
    "inspection.number.%",
    "processing.number.%",
    "settlement.number.%",
    "sale.number.%",
    "customers.number.%",
    "inventory.barcode.%",
)

SETTLEMENT_PERMISSION_KEYS: tuple[str, ...] = (
    "rental.settlement.view",
    "rental.settlement.create",
    "rental.settlement.collect",
    "rental.settlement.adjust",
)

REPORTS_FINANCIAL_PERMISSION_KEYS: tuple[str, ...] = (
    "reports.financial.view",
)

SYSTEM_ADMIN_PERMISSION_KEYS: tuple[str, ...] = (
    "system.view",
    "system.maintenance",
    "system.backup",
    "system.restore",
)


def _alembic_config() -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    return cfg


async def _fetch_counts(database_url: str) -> dict[str, int]:
    engine = create_async_engine(database_url)
    try:
        async with engine.connect() as conn:
            counts: dict[str, int] = {}
            for pattern in SETTING_KEY_PATTERNS:
                result = await conn.execute(
                    text(
                        "SELECT count(*) FROM settings "
                        "WHERE key LIKE :pattern AND is_deleted = false"
                    ),
                    {"pattern": pattern},
                )
                counts[pattern] = int(result.scalar_one())
            result = await conn.execute(
                text(
                    "SELECT count(*) FROM permissions WHERE key = ANY(:keys) AND is_deleted = false"
                ),
                {"keys": list(SETTLEMENT_PERMISSION_KEYS)},
            )
            counts["settlement_permissions"] = int(result.scalar_one())
            result = await conn.execute(
                text(
                    "SELECT count(*) FROM permissions WHERE key = ANY(:keys) AND is_deleted = false"
                ),
                {"keys": list(REPORTS_FINANCIAL_PERMISSION_KEYS)},
            )
            counts["reports_financial_permissions"] = int(result.scalar_one())
            result = await conn.execute(
                text(
                    "SELECT count(*) FROM permissions WHERE key = ANY(:keys) AND is_deleted = false"
                ),
                {"keys": list(SYSTEM_ADMIN_PERMISSION_KEYS)},
            )
            counts["system_admin_permissions"] = int(result.scalar_one())
            counts["settings_total"] = int(
                (
                    await conn.execute(
                        text("SELECT count(*) FROM settings WHERE is_deleted = false")
                    )
                ).scalar_one()
            )
            counts["permissions_total"] = int(
                (
                    await conn.execute(
                        text("SELECT count(*) FROM permissions WHERE is_deleted = false")
                    )
                ).scalar_one()
            )
            return counts
    finally:
        await engine.dispose()


async def _ping(database_url: str) -> None:
    engine = create_async_engine(database_url)
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    finally:
        await engine.dispose()


@pytest.fixture(scope="module")
def postgres_database_url() -> str:
    database_url = os.environ.get(
        "DATABASE_URL", "postgresql+asyncpg://juman:juman@localhost:5432/juman_test"
    )
    if "asyncpg" not in database_url:
        pytest.skip("Migration seed-cleanup tests require the asyncpg Postgres driver.")
    try:
        asyncio.run(_ping(database_url))
    except Exception as exc:  # noqa: BLE001 - environment probe, any failure means skip
        pytest.skip(f"Postgres test database is not reachable: {exc!r}")
    return database_url


def test_downgrade_removes_seeded_settings_and_permissions(
    postgres_database_url: str,
) -> None:
    """
    Downgrading past the reservations/rentals/returns/inspection/processing/
    settlements/sales/reports/system-admin/customers-v2/dress-barcodes migrations must remove every
    setting, permission, and barcode counter row they seeded — and a
    subsequent upgrade must restore the exact same reference-data counts.
    """
    cfg = _alembic_config()
    # Ensure the DB is at head so `before` reflects every migration seed.
    command.upgrade(cfg, "head")
    before = asyncio.run(_fetch_counts(postgres_database_url))
    assert before["settings_total"] > 0, "expected settings to be seeded before the test starts"

    try:
        command.downgrade(cfg, TARGET_REVISION)

        during = asyncio.run(_fetch_counts(postgres_database_url))
        for pattern in SETTING_KEY_PATTERNS:
            assert during[pattern] == 0, (
                f"settings matching {pattern!r} were not removed by downgrade; "
                "the migration's downgrade() is leaking seed data"
            )
        assert during["settlement_permissions"] == 0, (
            "settlement permissions were not removed by downgrade; "
            "the migration's downgrade() is leaking permission seed data"
        )
        assert during["reports_financial_permissions"] == 0, (
            "reports.financial.view was not removed by downgrade; "
            "the migration's downgrade() is leaking permission seed data"
        )
        assert during["system_admin_permissions"] == 0, (
            "system.* permissions were not removed by downgrade; "
            "the migration's downgrade() is leaking permission seed data"
        )
    finally:
        command.upgrade(cfg, "head")

    after = asyncio.run(_fetch_counts(postgres_database_url))
    assert after == before, (
        "settings/permissions counts after upgrade -> downgrade -> upgrade "
        "must match the counts before the round trip"
    )
