"""Add customer_number and profile fields; seed customer number settings.

Revision ID: 20260726_0016_customers_v2
Revises: 20260726_0015_dress_barcodes
Create Date: 2026-07-26 20:20:00
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "20260726_0016_customers_v2"
down_revision: str | None = "20260726_0015_dress_barcodes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CUSTOMER_NUMBER_SETTINGS: tuple[dict[str, object], ...] = (
    {
        "key": "customers.number.prefix",
        "value": "CUS",
        "value_type": "string",
        "category": "customers",
        "description": "بادئة رقم العميل",
        "is_editable": True,
    },
    {
        "key": "customers.number.separator",
        "value": "-",
        "value_type": "string",
        "category": "customers",
        "description": "فاصل رقم العميل (فارغ أو - أو _)",
        "is_editable": True,
    },
    {
        "key": "customers.number.padding",
        "value": 8,
        "value_type": "integer",
        "category": "customers",
        "description": "عدد أرقام تسلسل رقم العميل",
        "is_editable": True,
    },
)


def _serialize(value: object, value_type: str) -> str:
    if value_type == "boolean":
        return "true" if value else "false"
    return str(value)


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


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(UTC)

    for seed in CUSTOMER_NUMBER_SETTINGS:
        _upsert_setting(conn, seed, now=now)

    op.add_column("customers", sa.Column("customer_number", sa.String(length=64), nullable=True))
    op.add_column("customers", sa.Column("alternative_phone", sa.String(length=50), nullable=True))
    op.add_column("customers", sa.Column("gender", sa.String(length=20), nullable=True))
    op.add_column("customers", sa.Column("birth_date", sa.Date(), nullable=True))

    prefix = (_setting_value(conn, "customers.number.prefix") or "CUS").strip().upper() or "CUS"
    separator = _setting_value(conn, "customers.number.separator")
    if separator is None:
        separator = "-"
    padding_raw = _setting_value(conn, "customers.number.padding") or "8"
    try:
        padding = int(padding_raw)
    except ValueError:
        padding = 8
    padding = min(max(padding, 1), 16)

    # Ensure counter row for CUS prefix.
    existing_counter = conn.execute(
        sa.text("SELECT prefix FROM barcode_counters WHERE prefix = :prefix LIMIT 1"),
        {"prefix": prefix},
    ).fetchone()
    if existing_counter is None:
        conn.execute(
            sa.text(
                """
                INSERT INTO barcode_counters (prefix, last_value, updated_at)
                VALUES (:prefix, 0, :updated_at)
                """
            ),
            {"prefix": prefix, "updated_at": now},
        )

    null_rows = conn.execute(
        sa.text(
            """
            SELECT id FROM customers
            WHERE customer_number IS NULL
            ORDER BY created_at ASC
            """
        )
    ).fetchall()
    next_value = 0
    for row in null_rows:
        next_value += 1
        number = f"{prefix}{separator}{str(next_value).zfill(padding)}"
        conn.execute(
            sa.text("UPDATE customers SET customer_number = :number WHERE id = :id"),
            {"number": number, "id": str(row.id)},
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

    op.alter_column("customers", "customer_number", existing_type=sa.String(length=64), nullable=False)
    op.create_index("ix_customers_customer_number", "customers", ["customer_number"], unique=False)
    op.create_index(
        "uq_customers_number_alive",
        "customers",
        ["customer_number"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
        sqlite_where=sa.text("is_deleted = 0"),
    )


def downgrade() -> None:
    conn = op.get_bind()
    prefix_row = conn.execute(
        sa.text(
            "SELECT value FROM settings WHERE key = 'customers.number.prefix' "
            "AND is_deleted = false LIMIT 1"
        )
    ).fetchone()
    prefix = (prefix_row[0] if prefix_row else "CUS").strip().upper() or "CUS"
    conn.execute(sa.text("DELETE FROM barcode_counters WHERE prefix = :prefix"), {"prefix": prefix})
    for seed in CUSTOMER_NUMBER_SETTINGS:
        conn.execute(sa.text("DELETE FROM settings WHERE key = :key"), {"key": seed["key"]})

    op.drop_index("uq_customers_number_alive", table_name="customers")
    op.drop_index("ix_customers_customer_number", table_name="customers")
    op.drop_column("customers", "birth_date")
    op.drop_column("customers", "gender")
    op.drop_column("customers", "alternative_phone")
    op.drop_column("customers", "customer_number")
