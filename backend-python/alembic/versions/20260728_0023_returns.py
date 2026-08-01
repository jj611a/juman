"""Create returns + return_items; seed RET number settings.

Revision ID: 20260728_0023_returns
Revises: 20260728_0022_rentals_align
Create Date: 2026-07-28 01:10:00
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "20260728_0023_returns"
down_revision: str | None = "20260728_0022_rentals_align"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

RETURN_NUMBER_SETTINGS: tuple[dict[str, object], ...] = (
    {
        "key": "returns.number.prefix",
        "value": "RET",
        "value_type": "string",
        "category": "returns",
        "description": "بادئة رقم الإرجاع",
        "is_editable": True,
    },
    {
        "key": "returns.number.separator",
        "value": "-",
        "value_type": "string",
        "category": "returns",
        "description": "فاصل رقم الإرجاع (فارغ أو - أو _)",
        "is_editable": True,
    },
    {
        "key": "returns.number.padding",
        "value": 8,
        "value_type": "integer",
        "category": "returns",
        "description": "عدد أرقام تسلسل رقم الإرجاع",
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
            "value": _serialize(seed["value"], str(seed["value_type"])),
            "value_type": str(seed["value_type"]),
            "category": str(seed["category"]),
            "description": seed["description"],
            "is_editable": bool(seed["is_editable"]),
            "created_at": now,
            "updated_at": now,
        },
    )


def _audit_columns() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("created_by", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("updated_by", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.Uuid(as_uuid=True), nullable=True),
    ]


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(UTC)
    for seed in RETURN_NUMBER_SETTINGS:
        _upsert_setting(conn, seed, now=now)

    prefix_row = conn.execute(
        sa.text(
            "SELECT value FROM settings WHERE key = 'returns.number.prefix' "
            "AND is_deleted = false LIMIT 1"
        )
    ).fetchone()
    prefix = (prefix_row[0] if prefix_row else "RET").strip().upper() or "RET"
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

    op.create_table(
        "returns",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("return_number", sa.String(length=50), nullable=False),
        sa.Column("rental_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("customer_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("returned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("returned_by", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("notes", sa.String(length=2000), nullable=True),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["rental_id"],
            ["rentals.id"],
            name="fk_returns_rental_id_rentals",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["customers.id"],
            name="fk_returns_customer_id_customers",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_returns"),
    )
    op.create_index("ix_returns_return_number", "returns", ["return_number"])
    op.create_index("ix_returns_rental_id", "returns", ["rental_id"])
    op.create_index("ix_returns_customer_id", "returns", ["customer_id"])
    op.create_index("ix_returns_status", "returns", ["status"])
    op.create_index("ix_returns_returned_at", "returns", ["returned_at"])
    op.create_index("ix_returns_is_deleted", "returns", ["is_deleted"])
    op.create_index("ix_returns_created_at", "returns", ["created_at"])
    op.create_index(
        "uq_returns_number_alive",
        "returns",
        ["return_number"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
        sqlite_where=sa.text("is_deleted = 0"),
    )
    op.create_index(
        "uq_returns_rental_id_alive",
        "returns",
        ["rental_id"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
        sqlite_where=sa.text("is_deleted = 0"),
    )

    op.create_table(
        "return_items",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("return_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("rental_item_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("dress_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("returned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.String(length=1000), nullable=True),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["return_id"],
            ["returns.id"],
            name="fk_return_items_return_id_returns",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["rental_item_id"],
            ["rental_items.id"],
            name="fk_return_items_rental_item_id_rental_items",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["dress_id"],
            ["dresses.id"],
            name="fk_return_items_dress_id_dresses",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_return_items"),
    )
    op.create_index("ix_return_items_return_id", "return_items", ["return_id"])
    op.create_index("ix_return_items_rental_item_id", "return_items", ["rental_item_id"])
    op.create_index("ix_return_items_dress_id", "return_items", ["dress_id"])
    op.create_index(
        "ix_return_items_return_id_dress_id",
        "return_items",
        ["return_id", "dress_id"],
    )
    op.create_index("ix_return_items_is_deleted", "return_items", ["is_deleted"])
    op.create_index("ix_return_items_created_at", "return_items", ["created_at"])


def downgrade() -> None:
    conn = op.get_bind()
    prefix_row = conn.execute(
        sa.text(
            "SELECT value FROM settings WHERE key = 'returns.number.prefix' "
            "AND is_deleted = false LIMIT 1"
        )
    ).fetchone()
    prefix = (prefix_row[0] if prefix_row else "RET").strip().upper() or "RET"
    conn.execute(sa.text("DELETE FROM barcode_counters WHERE prefix = :prefix"), {"prefix": prefix})
    for seed in RETURN_NUMBER_SETTINGS:
        conn.execute(sa.text("DELETE FROM settings WHERE key = :key"), {"key": seed["key"]})

    op.drop_index("ix_return_items_created_at", table_name="return_items")
    op.drop_index("ix_return_items_is_deleted", table_name="return_items")
    op.drop_index("ix_return_items_return_id_dress_id", table_name="return_items")
    op.drop_index("ix_return_items_dress_id", table_name="return_items")
    op.drop_index("ix_return_items_rental_item_id", table_name="return_items")
    op.drop_index("ix_return_items_return_id", table_name="return_items")
    op.drop_table("return_items")

    op.drop_index("uq_returns_rental_id_alive", table_name="returns")
    op.drop_index("uq_returns_number_alive", table_name="returns")
    op.drop_index("ix_returns_created_at", table_name="returns")
    op.drop_index("ix_returns_is_deleted", table_name="returns")
    op.drop_index("ix_returns_returned_at", table_name="returns")
    op.drop_index("ix_returns_status", table_name="returns")
    op.drop_index("ix_returns_customer_id", table_name="returns")
    op.drop_index("ix_returns_rental_id", table_name="returns")
    op.drop_index("ix_returns_return_number", table_name="returns")
    op.drop_table("returns")
