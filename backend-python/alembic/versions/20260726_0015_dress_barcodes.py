"""Create barcode_counters, migrate barcode settings, enforce NOT NULL barcodes.

Revision ID: 20260726_0015_dress_barcodes
Revises: 20260726_0014_dresses
Create Date: 2026-07-26 19:30:00
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "20260726_0015_dress_barcodes"
down_revision: str | None = "20260726_0014_dresses"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

BARCODE_SETTINGS: tuple[dict[str, object], ...] = (
    {
        "key": "inventory.barcode.prefix",
        "value": "DR",
        "value_type": "string",
        "category": "inventory",
        "description": "بادئة باركود الفساتين",
        "is_editable": True,
    },
    {
        "key": "inventory.barcode.separator",
        "value": "-",
        "value_type": "string",
        "category": "inventory",
        "description": "فاصل باركود الفساتين (فارغ أو - أو _)",
        "is_editable": True,
    },
    {
        "key": "inventory.barcode.padding",
        "value": 8,
        "value_type": "integer",
        "category": "inventory",
        "description": "عدد أرقام التسلسل في باركود الفستان",
        "is_editable": True,
    },
)

_LEGACY_PREFIX = "barcode_prefix"
_LEGACY_LENGTH = "barcode_length"


def _serialize(value: object, value_type: str) -> str:
    if value_type == "boolean":
        return "true" if value else "false"
    return str(value)


def _setting_value(conn, key: str) -> str | None:
    row = conn.execute(
        sa.text(
            """
            SELECT value FROM settings
            WHERE key = :key AND is_deleted = false
            LIMIT 1
            """
        ),
        {"key": key},
    ).fetchone()
    return None if row is None else str(row.value)


def _upsert_setting(conn, seed: dict[str, object], *, now: datetime) -> None:
    key = str(seed["key"])
    existing = conn.execute(
        sa.text("SELECT id FROM settings WHERE key = :key AND is_deleted = false LIMIT 1"),
        {"key": key},
    ).fetchone()
    if existing is not None:
        return
    value_type = str(seed["value_type"])
    conn.execute(
        sa.text(
            """
            INSERT INTO settings (
                id, key, value, value_type, category, description,
                is_editable, created_at, updated_at, is_deleted
            ) VALUES (
                :id, :key, :value, :value_type, :category, :description,
                :is_editable, :created_at, :updated_at, false
            )
            """
        ),
        {
            "id": str(uuid4()),
            "key": key,
            "value": _serialize(seed["value"], value_type),
            "value_type": value_type,
            "category": str(seed["category"]),
            "description": seed["description"],
            "is_editable": bool(seed["is_editable"]),
            "created_at": now,
            "updated_at": now,
        },
    )


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(UTC)

    legacy_prefix = _setting_value(conn, _LEGACY_PREFIX) or "DR"
    legacy_length_raw = _setting_value(conn, _LEGACY_LENGTH)
    try:
        legacy_padding = int(legacy_length_raw) if legacy_length_raw is not None else 8
    except ValueError:
        legacy_padding = 8
    if legacy_padding < 1:
        legacy_padding = 8

    seeds = []
    for seed in BARCODE_SETTINGS:
        row = dict(seed)
        if row["key"] == "inventory.barcode.prefix":
            row["value"] = legacy_prefix.strip().upper() or "DR"
        if row["key"] == "inventory.barcode.padding":
            row["value"] = min(max(legacy_padding, 1), 16)
        seeds.append(row)

    for seed in seeds:
        _upsert_setting(conn, seed, now=now)

    # Soft-delete legacy barcode settings if present.
    for legacy_key in (_LEGACY_PREFIX, _LEGACY_LENGTH):
        conn.execute(
            sa.text(
                """
                UPDATE settings
                SET is_deleted = true, deleted_at = :deleted_at
                WHERE key = :key AND is_deleted = false
                """
            ),
            {"key": legacy_key, "deleted_at": now},
        )

    op.create_table(
        "barcode_counters",
        sa.Column("prefix", sa.String(length=32), nullable=False),
        sa.Column("last_value", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("prefix", name="pk_barcode_counters"),
    )

    prefix = (_setting_value(conn, "inventory.barcode.prefix") or "DR").strip().upper() or "DR"
    separator = _setting_value(conn, "inventory.barcode.separator")
    if separator is None:
        separator = "-"
    padding_raw = _setting_value(conn, "inventory.barcode.padding") or "8"
    try:
        padding = int(padding_raw)
    except ValueError:
        padding = 8
    padding = min(max(padding, 1), 16)

    conn.execute(
        sa.text(
            """
            INSERT INTO barcode_counters (prefix, last_value, updated_at)
            VALUES (:prefix, 0, :updated_at)
            """
        ),
        {"prefix": prefix, "updated_at": now},
    )

    # Backfill NULL barcodes before NOT NULL.
    null_rows = conn.execute(
        sa.text(
            """
            SELECT id FROM dresses
            WHERE barcode IS NULL
            ORDER BY created_at ASC
            """
        )
    ).fetchall()
    next_value = 0
    for row in null_rows:
        next_value += 1
        barcode = f"{prefix}{separator}{str(next_value).zfill(padding)}"
        conn.execute(
            sa.text("UPDATE dresses SET barcode = :barcode WHERE id = :id"),
            {"barcode": barcode, "id": str(row.id)},
        )

    if next_value > 0:
        conn.execute(
            sa.text(
                """
                UPDATE barcode_counters
                SET last_value = :last_value, updated_at = :updated_at
                WHERE prefix = :prefix
                """
            ),
            {"last_value": next_value, "updated_at": now, "prefix": prefix},
        )

    op.drop_index("uq_dresses_barcode_alive", table_name="dresses")
    op.alter_column("dresses", "barcode", existing_type=sa.String(length=64), nullable=False)
    op.create_index(
        "uq_dresses_barcode_alive",
        "dresses",
        ["barcode"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
        sqlite_where=sa.text("is_deleted = 0"),
    )


def downgrade() -> None:
    conn = op.get_bind()
    for seed in BARCODE_SETTINGS:
        conn.execute(sa.text("DELETE FROM settings WHERE key = :key"), {"key": seed["key"]})
    for legacy_key in (_LEGACY_PREFIX, _LEGACY_LENGTH):
        conn.execute(
            sa.text(
                """
                UPDATE settings
                SET is_deleted = false, deleted_at = NULL
                WHERE key = :key AND is_deleted = true
                """
            ),
            {"key": legacy_key},
        )

    op.drop_index("uq_dresses_barcode_alive", table_name="dresses")
    op.alter_column("dresses", "barcode", existing_type=sa.String(length=64), nullable=True)
    op.create_index(
        "uq_dresses_barcode_alive",
        "dresses",
        ["barcode"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false AND barcode IS NOT NULL"),
        sqlite_where=sa.text("is_deleted = 0 AND barcode IS NOT NULL"),
    )
    op.drop_table("barcode_counters")
