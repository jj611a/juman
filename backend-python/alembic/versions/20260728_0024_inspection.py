"""Create inspections + inspection_items; seed INS number settings.

Revision ID: 20260728_0024_inspection
Revises: 20260728_0023_returns
Create Date: 2026-07-28 01:40:00
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "20260728_0024_inspection"
down_revision: str | None = "20260728_0023_returns"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

INSPECTION_NUMBER_SETTINGS: tuple[dict[str, object], ...] = (
    {
        "key": "inspection.number.prefix",
        "value": "INS",
        "value_type": "string",
        "category": "inspection",
        "description": "بادئة رقم الفحص",
        "is_editable": True,
    },
    {
        "key": "inspection.number.separator",
        "value": "-",
        "value_type": "string",
        "category": "inspection",
        "description": "فاصل رقم الفحص (فارغ أو - أو _)",
        "is_editable": True,
    },
    {
        "key": "inspection.number.padding",
        "value": 8,
        "value_type": "integer",
        "category": "inspection",
        "description": "عدد أرقام تسلسل رقم الفحص",
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
    for seed in INSPECTION_NUMBER_SETTINGS:
        _upsert_setting(conn, seed, now=now)

    prefix_row = conn.execute(
        sa.text(
            "SELECT value FROM settings WHERE key = 'inspection.number.prefix' "
            "AND is_deleted = false LIMIT 1"
        )
    ).fetchone()
    prefix = (prefix_row[0] if prefix_row else "INS").strip().upper() or "INS"
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
        "inspections",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("inspection_number", sa.String(length=50), nullable=False),
        sa.Column("return_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("inspected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("inspected_by", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("notes", sa.String(length=2000), nullable=True),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["return_id"],
            ["returns.id"],
            name="fk_inspections_return_id_returns",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_inspections"),
    )
    op.create_index("ix_inspections_inspection_number", "inspections", ["inspection_number"])
    op.create_index("ix_inspections_return_id", "inspections", ["return_id"])
    op.create_index("ix_inspections_status", "inspections", ["status"])
    op.create_index("ix_inspections_inspected_at", "inspections", ["inspected_at"])
    op.create_index("ix_inspections_is_deleted", "inspections", ["is_deleted"])
    op.create_index("ix_inspections_created_at", "inspections", ["created_at"])
    op.create_index(
        "uq_inspections_number_alive",
        "inspections",
        ["inspection_number"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
        sqlite_where=sa.text("is_deleted = 0"),
    )
    op.create_index(
        "uq_inspections_return_id_alive",
        "inspections",
        ["return_id"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
        sqlite_where=sa.text("is_deleted = 0"),
    )

    op.create_table(
        "inspection_items",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("inspection_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("return_item_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("dress_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("condition", sa.String(length=32), nullable=True),
        sa.Column("repair_penalty_amount", sa.BigInteger(), nullable=True),
        sa.Column("repair_notes", sa.String(length=2000), nullable=True),
        sa.Column("requires_laundry", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("send_to_ruined", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("notes", sa.String(length=1000), nullable=True),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["inspection_id"],
            ["inspections.id"],
            name="fk_inspection_items_inspection_id_inspections",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["return_item_id"],
            ["return_items.id"],
            name="fk_inspection_items_return_item_id_return_items",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["dress_id"],
            ["dresses.id"],
            name="fk_inspection_items_dress_id_dresses",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_inspection_items"),
    )
    op.create_index("ix_inspection_items_inspection_id", "inspection_items", ["inspection_id"])
    op.create_index("ix_inspection_items_return_item_id", "inspection_items", ["return_item_id"])
    op.create_index("ix_inspection_items_dress_id", "inspection_items", ["dress_id"])
    op.create_index(
        "ix_inspection_items_inspection_id_dress_id",
        "inspection_items",
        ["inspection_id", "dress_id"],
    )
    op.create_index("ix_inspection_items_is_deleted", "inspection_items", ["is_deleted"])
    op.create_index("ix_inspection_items_created_at", "inspection_items", ["created_at"])
    op.create_index(
        "uq_inspection_items_return_item_alive",
        "inspection_items",
        ["return_item_id"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
        sqlite_where=sa.text("is_deleted = 0"),
    )


def downgrade() -> None:
    conn = op.get_bind()
    prefix_row = conn.execute(
        sa.text(
            "SELECT value FROM settings WHERE key = 'inspection.number.prefix' "
            "AND is_deleted = false LIMIT 1"
        )
    ).fetchone()
    prefix = (prefix_row[0] if prefix_row else "INS").strip().upper() or "INS"
    conn.execute(sa.text("DELETE FROM barcode_counters WHERE prefix = :prefix"), {"prefix": prefix})
    for seed in INSPECTION_NUMBER_SETTINGS:
        conn.execute(sa.text("DELETE FROM settings WHERE key = :key"), {"key": seed["key"]})

    op.drop_index("uq_inspection_items_return_item_alive", table_name="inspection_items")
    op.drop_index("ix_inspection_items_created_at", table_name="inspection_items")
    op.drop_index("ix_inspection_items_is_deleted", table_name="inspection_items")
    op.drop_index("ix_inspection_items_inspection_id_dress_id", table_name="inspection_items")
    op.drop_index("ix_inspection_items_dress_id", table_name="inspection_items")
    op.drop_index("ix_inspection_items_return_item_id", table_name="inspection_items")
    op.drop_index("ix_inspection_items_inspection_id", table_name="inspection_items")
    op.drop_table("inspection_items")

    op.drop_index("uq_inspections_return_id_alive", table_name="inspections")
    op.drop_index("uq_inspections_number_alive", table_name="inspections")
    op.drop_index("ix_inspections_created_at", table_name="inspections")
    op.drop_index("ix_inspections_is_deleted", table_name="inspections")
    op.drop_index("ix_inspections_inspected_at", table_name="inspections")
    op.drop_index("ix_inspections_status", table_name="inspections")
    op.drop_index("ix_inspections_return_id", table_name="inspections")
    op.drop_index("ix_inspections_inspection_number", table_name="inspections")
    op.drop_table("inspections")
