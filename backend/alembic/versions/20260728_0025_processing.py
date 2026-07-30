"""Create processing_batches + processing_items; seed PRC number settings.

Revision ID: 20260728_0025_processing
Revises: 20260728_0024_inspection
Create Date: 2026-07-28 02:10:00
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "20260728_0025_processing"
down_revision: str | None = "20260728_0024_inspection"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PROCESSING_NUMBER_SETTINGS: tuple[dict[str, object], ...] = (
    {
        "key": "processing.number.prefix",
        "value": "PRC",
        "value_type": "string",
        "category": "processing",
        "description": "بادئة رقم المعالجة",
        "is_editable": True,
    },
    {
        "key": "processing.number.separator",
        "value": "-",
        "value_type": "string",
        "category": "processing",
        "description": "فاصل رقم المعالجة (فارغ أو - أو _)",
        "is_editable": True,
    },
    {
        "key": "processing.number.padding",
        "value": 8,
        "value_type": "integer",
        "category": "processing",
        "description": "عدد أرقام تسلسل رقم المعالجة",
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
    for seed in PROCESSING_NUMBER_SETTINGS:
        _upsert_setting(conn, seed, now=now)

    prefix_row = conn.execute(
        sa.text(
            "SELECT value FROM settings WHERE key = 'processing.number.prefix' "
            "AND is_deleted = false LIMIT 1"
        )
    ).fetchone()
    prefix = (prefix_row[0] if prefix_row else "PRC").strip().upper() or "PRC"
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
        "processing_batches",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("processing_number", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("mandatory_processing_end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "optional_extra_day_enabled",
            sa.Boolean(),
            server_default="false",
            nullable=False,
        ),
        sa.Column("final_processing_end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_by", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("completed_by", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("notes", sa.String(length=2000), nullable=True),
        *_audit_columns(),
        sa.PrimaryKeyConstraint("id", name="pk_processing_batches"),
    )
    op.create_index(
        "ix_processing_batches_processing_number",
        "processing_batches",
        ["processing_number"],
    )
    op.create_index("ix_processing_batches_status", "processing_batches", ["status"])
    op.create_index("ix_processing_batches_started_at", "processing_batches", ["started_at"])
    op.create_index("ix_processing_batches_is_deleted", "processing_batches", ["is_deleted"])
    op.create_index("ix_processing_batches_created_at", "processing_batches", ["created_at"])
    op.create_index(
        "uq_processing_batches_number_alive",
        "processing_batches",
        ["processing_number"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
        sqlite_where=sa.text("is_deleted = 0"),
    )

    op.create_table(
        "processing_items",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("processing_batch_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("dress_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("inspection_item_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("return_item_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("rental_item_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("calendar_block_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("notes", sa.String(length=1000), nullable=True),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["processing_batch_id"],
            ["processing_batches.id"],
            name="fk_processing_items_batch_id_processing_batches",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["dress_id"],
            ["dresses.id"],
            name="fk_processing_items_dress_id_dresses",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["inspection_item_id"],
            ["inspection_items.id"],
            name="fk_processing_items_inspection_item_id_inspection_items",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["return_item_id"],
            ["return_items.id"],
            name="fk_processing_items_return_item_id_return_items",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["rental_item_id"],
            ["rental_items.id"],
            name="fk_processing_items_rental_item_id_rental_items",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["calendar_block_id"],
            ["dress_calendar_blocks.id"],
            name="fk_processing_items_calendar_block_id_dress_calendar_blocks",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_processing_items"),
    )
    op.create_index(
        "ix_processing_items_processing_batch_id",
        "processing_items",
        ["processing_batch_id"],
    )
    op.create_index("ix_processing_items_dress_id", "processing_items", ["dress_id"])
    op.create_index(
        "ix_processing_items_inspection_item_id",
        "processing_items",
        ["inspection_item_id"],
    )
    op.create_index(
        "ix_processing_items_return_item_id",
        "processing_items",
        ["return_item_id"],
    )
    op.create_index(
        "ix_processing_items_rental_item_id",
        "processing_items",
        ["rental_item_id"],
    )
    op.create_index(
        "ix_processing_items_calendar_block_id",
        "processing_items",
        ["calendar_block_id"],
    )
    op.create_index("ix_processing_items_status", "processing_items", ["status"])
    op.create_index(
        "ix_processing_items_batch_id_dress_id",
        "processing_items",
        ["processing_batch_id", "dress_id"],
    )
    op.create_index("ix_processing_items_is_deleted", "processing_items", ["is_deleted"])
    op.create_index("ix_processing_items_created_at", "processing_items", ["created_at"])
    op.create_index(
        "uq_processing_items_inspection_item_active",
        "processing_items",
        ["inspection_item_id"],
        unique=True,
        postgresql_where=sa.text(
            "is_deleted = false AND status IN ('PENDING', 'IN_PROCESS')"
        ),
        sqlite_where=sa.text("is_deleted = 0 AND status IN ('PENDING', 'IN_PROCESS')"),
    )
    op.create_index(
        "uq_processing_items_dress_active",
        "processing_items",
        ["dress_id"],
        unique=True,
        postgresql_where=sa.text(
            "is_deleted = false AND status IN ('PENDING', 'IN_PROCESS')"
        ),
        sqlite_where=sa.text("is_deleted = 0 AND status IN ('PENDING', 'IN_PROCESS')"),
    )


def downgrade() -> None:
    conn = op.get_bind()
    prefix_row = conn.execute(
        sa.text(
            "SELECT value FROM settings WHERE key = 'processing.number.prefix' "
            "AND is_deleted = false LIMIT 1"
        )
    ).fetchone()
    prefix = (prefix_row[0] if prefix_row else "PRC").strip().upper() or "PRC"
    conn.execute(sa.text("DELETE FROM barcode_counters WHERE prefix = :prefix"), {"prefix": prefix})
    for seed in PROCESSING_NUMBER_SETTINGS:
        conn.execute(sa.text("DELETE FROM settings WHERE key = :key"), {"key": seed["key"]})

    op.drop_index("uq_processing_items_dress_active", table_name="processing_items")
    op.drop_index("uq_processing_items_inspection_item_active", table_name="processing_items")
    op.drop_index("ix_processing_items_created_at", table_name="processing_items")
    op.drop_index("ix_processing_items_is_deleted", table_name="processing_items")
    op.drop_index("ix_processing_items_batch_id_dress_id", table_name="processing_items")
    op.drop_index("ix_processing_items_status", table_name="processing_items")
    op.drop_index("ix_processing_items_calendar_block_id", table_name="processing_items")
    op.drop_index("ix_processing_items_rental_item_id", table_name="processing_items")
    op.drop_index("ix_processing_items_return_item_id", table_name="processing_items")
    op.drop_index("ix_processing_items_inspection_item_id", table_name="processing_items")
    op.drop_index("ix_processing_items_dress_id", table_name="processing_items")
    op.drop_index("ix_processing_items_processing_batch_id", table_name="processing_items")
    op.drop_table("processing_items")

    op.drop_index("uq_processing_batches_number_alive", table_name="processing_batches")
    op.drop_index("ix_processing_batches_created_at", table_name="processing_batches")
    op.drop_index("ix_processing_batches_is_deleted", table_name="processing_batches")
    op.drop_index("ix_processing_batches_started_at", table_name="processing_batches")
    op.drop_index("ix_processing_batches_status", table_name="processing_batches")
    op.drop_index("ix_processing_batches_processing_number", table_name="processing_batches")
    op.drop_table("processing_batches")
