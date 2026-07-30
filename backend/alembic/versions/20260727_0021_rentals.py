"""Create rentals + rental_items; seed RENT number settings.

Revision ID: 20260727_0021_rentals
Revises: 20260727_0020_reservations
Create Date: 2026-07-27 02:40:00
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "20260727_0021_rentals"
down_revision: str | None = "20260727_0020_reservations"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

RENTAL_NUMBER_SETTINGS: tuple[dict[str, object], ...] = (
    {
        "key": "rentals.number.prefix",
        "value": "RENT",
        "value_type": "string",
        "category": "rentals",
        "description": "بادئة رقم الإيجار",
        "is_editable": True,
    },
    {
        "key": "rentals.number.separator",
        "value": "-",
        "value_type": "string",
        "category": "rentals",
        "description": "فاصل رقم الإيجار (فارغ أو - أو _)",
        "is_editable": True,
    },
    {
        "key": "rentals.number.padding",
        "value": 8,
        "value_type": "integer",
        "category": "rentals",
        "description": "عدد أرقام تسلسل رقم الإيجار",
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
    for seed in RENTAL_NUMBER_SETTINGS:
        _upsert_setting(conn, seed, now=now)

    prefix_row = conn.execute(
        sa.text(
            "SELECT value FROM settings WHERE key = 'rentals.number.prefix' "
            "AND is_deleted = false LIMIT 1"
        )
    ).fetchone()
    prefix = (prefix_row[0] if prefix_row else "RENT").strip().upper() or "RENT"
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
        "rentals",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("rental_number", sa.String(length=50), nullable=False),
        sa.Column("customer_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("reservation_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("rental_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expected_return_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("initial_payment_type", sa.String(length=20), nullable=False),
        sa.Column("initial_payment_rate", sa.Integer(), nullable=True),
        sa.Column("initial_payment_value", sa.BigInteger(), nullable=False),
        sa.Column("estimated_total", sa.BigInteger(), nullable=False),
        sa.Column("remaining_balance", sa.BigInteger(), nullable=False),
        sa.Column("notes", sa.String(length=2000), nullable=True),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["customers.id"],
            name="fk_rentals_customer_id_customers",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["reservation_id"],
            ["reservations.id"],
            name="fk_rentals_reservation_id_reservations",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_rentals"),
    )
    op.create_index("ix_rentals_rental_number", "rentals", ["rental_number"])
    op.create_index("ix_rentals_customer_id", "rentals", ["customer_id"])
    op.create_index("ix_rentals_reservation_id", "rentals", ["reservation_id"])
    op.create_index("ix_rentals_status", "rentals", ["status"])
    op.create_index("ix_rentals_rental_at", "rentals", ["rental_at"])
    op.create_index("ix_rentals_is_deleted", "rentals", ["is_deleted"])
    op.create_index("ix_rentals_created_at", "rentals", ["created_at"])
    op.create_index(
        "uq_rentals_number_alive",
        "rentals",
        ["rental_number"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
        sqlite_where=sa.text("is_deleted = 0"),
    )

    op.create_table(
        "rental_items",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("rental_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("dress_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("agreed_daily_rental_price", sa.BigInteger(), nullable=False),
        sa.Column("expected_rental_days", sa.Integer(), nullable=False),
        sa.Column("notes", sa.String(length=1000), nullable=True),
        sa.Column("calendar_block_id", sa.Uuid(as_uuid=True), nullable=True),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["rental_id"],
            ["rentals.id"],
            name="fk_rental_items_rental_id_rentals",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["dress_id"],
            ["dresses.id"],
            name="fk_rental_items_dress_id_dresses",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_rental_items"),
    )
    op.create_index("ix_rental_items_rental_id", "rental_items", ["rental_id"])
    op.create_index("ix_rental_items_dress_id", "rental_items", ["dress_id"])
    op.create_index("ix_rental_items_rental_id_dress_id", "rental_items", ["rental_id", "dress_id"])
    op.create_index("ix_rental_items_calendar_block_id", "rental_items", ["calendar_block_id"])
    op.create_index("ix_rental_items_is_deleted", "rental_items", ["is_deleted"])
    op.create_index("ix_rental_items_created_at", "rental_items", ["created_at"])


def downgrade() -> None:
    conn = op.get_bind()
    prefix_row = conn.execute(
        sa.text(
            "SELECT value FROM settings WHERE key = 'rentals.number.prefix' "
            "AND is_deleted = false LIMIT 1"
        )
    ).fetchone()
    prefix = (prefix_row[0] if prefix_row else "RENT").strip().upper() or "RENT"
    conn.execute(sa.text("DELETE FROM barcode_counters WHERE prefix = :prefix"), {"prefix": prefix})
    for seed in RENTAL_NUMBER_SETTINGS:
        conn.execute(sa.text("DELETE FROM settings WHERE key = :key"), {"key": seed["key"]})

    op.drop_index("ix_rental_items_created_at", table_name="rental_items")
    op.drop_index("ix_rental_items_is_deleted", table_name="rental_items")
    op.drop_index("ix_rental_items_calendar_block_id", table_name="rental_items")
    op.drop_index("ix_rental_items_rental_id_dress_id", table_name="rental_items")
    op.drop_index("ix_rental_items_dress_id", table_name="rental_items")
    op.drop_index("ix_rental_items_rental_id", table_name="rental_items")
    op.drop_table("rental_items")

    op.drop_index("uq_rentals_number_alive", table_name="rentals")
    op.drop_index("ix_rentals_created_at", table_name="rentals")
    op.drop_index("ix_rentals_is_deleted", table_name="rentals")
    op.drop_index("ix_rentals_rental_at", table_name="rentals")
    op.drop_index("ix_rentals_status", table_name="rentals")
    op.drop_index("ix_rentals_reservation_id", table_name="rentals")
    op.drop_index("ix_rentals_customer_id", table_name="rentals")
    op.drop_index("ix_rentals_rental_number", table_name="rentals")
    op.drop_table("rentals")
