"""Create reservations + reservation_items; seed RSV number settings.

Revision ID: 20260727_0020_reservations
Revises: 20260727_0019_calendar
Create Date: 2026-07-27 02:10:00
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "20260727_0020_reservations"
down_revision: str | None = "20260727_0019_calendar"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

RESERVATION_NUMBER_SETTINGS: tuple[dict[str, object], ...] = (
    {
        "key": "reservations.number.prefix",
        "value": "RSV",
        "value_type": "string",
        "category": "reservations",
        "description": "بادئة رقم الحجز",
        "is_editable": True,
    },
    {
        "key": "reservations.number.separator",
        "value": "-",
        "value_type": "string",
        "category": "reservations",
        "description": "فاصل رقم الحجز (فارغ أو - أو _)",
        "is_editable": True,
    },
    {
        "key": "reservations.number.padding",
        "value": 8,
        "value_type": "integer",
        "category": "reservations",
        "description": "عدد أرقام تسلسل رقم الحجز",
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
    for seed in RESERVATION_NUMBER_SETTINGS:
        _upsert_setting(conn, seed, now=now)

    prefix_row = conn.execute(
        sa.text(
            "SELECT value FROM settings WHERE key = 'reservations.number.prefix' "
            "AND is_deleted = false LIMIT 1"
        )
    ).fetchone()
    prefix = (prefix_row[0] if prefix_row else "RSV").strip().upper() or "RSV"
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
        "reservations",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("reservation_number", sa.String(length=50), nullable=False),
        sa.Column("customer_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("reservation_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("rental_start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expected_return_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("notes", sa.String(length=2000), nullable=True),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["customers.id"],
            name="fk_reservations_customer_id_customers",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_reservations"),
    )
    op.create_index("ix_reservations_reservation_number", "reservations", ["reservation_number"])
    op.create_index("ix_reservations_customer_id", "reservations", ["customer_id"])
    op.create_index("ix_reservations_status", "reservations", ["status"])
    op.create_index("ix_reservations_rental_start_at", "reservations", ["rental_start_at"])
    op.create_index("ix_reservations_is_deleted", "reservations", ["is_deleted"])
    op.create_index("ix_reservations_created_at", "reservations", ["created_at"])
    op.create_index(
        "uq_reservations_number_alive",
        "reservations",
        ["reservation_number"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
        sqlite_where=sa.text("is_deleted = 0"),
    )

    op.create_table(
        "reservation_items",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("reservation_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("dress_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("reserved_daily_rental_price", sa.BigInteger(), nullable=False),
        sa.Column("notes", sa.String(length=1000), nullable=True),
        sa.Column("calendar_block_id", sa.Uuid(as_uuid=True), nullable=True),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["reservation_id"],
            ["reservations.id"],
            name="fk_reservation_items_reservation_id_reservations",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["dress_id"],
            ["dresses.id"],
            name="fk_reservation_items_dress_id_dresses",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_reservation_items"),
    )
    op.create_index("ix_reservation_items_reservation_id", "reservation_items", ["reservation_id"])
    op.create_index("ix_reservation_items_dress_id", "reservation_items", ["dress_id"])
    op.create_index(
        "ix_reservation_items_reservation_id_dress_id",
        "reservation_items",
        ["reservation_id", "dress_id"],
    )
    op.create_index("ix_reservation_items_calendar_block_id", "reservation_items", ["calendar_block_id"])
    op.create_index("ix_reservation_items_is_deleted", "reservation_items", ["is_deleted"])
    op.create_index("ix_reservation_items_created_at", "reservation_items", ["created_at"])


def downgrade() -> None:
    conn = op.get_bind()
    prefix_row = conn.execute(
        sa.text(
            "SELECT value FROM settings WHERE key = 'reservations.number.prefix' "
            "AND is_deleted = false LIMIT 1"
        )
    ).fetchone()
    prefix = (prefix_row[0] if prefix_row else "RSV").strip().upper() or "RSV"
    conn.execute(sa.text("DELETE FROM barcode_counters WHERE prefix = :prefix"), {"prefix": prefix})
    for seed in RESERVATION_NUMBER_SETTINGS:
        conn.execute(sa.text("DELETE FROM settings WHERE key = :key"), {"key": seed["key"]})

    op.drop_index("ix_reservation_items_created_at", table_name="reservation_items")
    op.drop_index("ix_reservation_items_is_deleted", table_name="reservation_items")
    op.drop_index("ix_reservation_items_calendar_block_id", table_name="reservation_items")
    op.drop_index("ix_reservation_items_reservation_id_dress_id", table_name="reservation_items")
    op.drop_index("ix_reservation_items_dress_id", table_name="reservation_items")
    op.drop_index("ix_reservation_items_reservation_id", table_name="reservation_items")
    op.drop_table("reservation_items")

    op.drop_index("uq_reservations_number_alive", table_name="reservations")
    op.drop_index("ix_reservations_created_at", table_name="reservations")
    op.drop_index("ix_reservations_is_deleted", table_name="reservations")
    op.drop_index("ix_reservations_rental_start_at", table_name="reservations")
    op.drop_index("ix_reservations_status", table_name="reservations")
    op.drop_index("ix_reservations_customer_id", table_name="reservations")
    op.drop_index("ix_reservations_reservation_number", table_name="reservations")
    op.drop_table("reservations")
