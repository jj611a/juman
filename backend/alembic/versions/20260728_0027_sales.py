"""Create sales tables; seed SAL numbering settings + barcode counter.

Revision ID: 20260728_0027_sales
Revises: 20260728_0026_settlements
Create Date: 2026-07-28 03:10:00
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "20260728_0027_sales"
down_revision: str | None = "20260728_0026_settlements"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SALE_NUMBER_SETTINGS: tuple[dict[str, object], ...] = (
    {
        "key": "sale.number.prefix",
        "value": "SAL",
        "value_type": "string",
        "category": "sales",
        "description": "\u0628\u0627\u062f\u0626\u0629 \u0631\u0642\u0645 \u0627\u0644\u0628\u064a\u0639",
        "is_editable": True,
    },
    {
        "key": "sale.number.separator",
        "value": "-",
        "value_type": "string",
        "category": "sales",
        "description": "\u0641\u0627\u0635\u0644 \u0631\u0642\u0645 \u0627\u0644\u0628\u064a\u0639 (\u0641\u0627\u0631\u063a \u0623\u0648 - \u0623\u0648 _)",
        "is_editable": True,
    },
    {
        "key": "sale.number.padding",
        "value": 8,
        "value_type": "integer",
        "category": "sales",
        "description": "\u0639\u062f\u062f \u0623\u0631\u0642\u0627\u0645 \u062a\u0633\u0644\u0633\u0644 \u0631\u0642\u0645 \u0627\u0644\u0628\u064a\u0639",
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


def _immutable_audit_columns() -> list[sa.Column]:
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
    ]


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(UTC)
    for seed in SALE_NUMBER_SETTINGS:
        _upsert_setting(conn, seed, now=now)

    prefix_row = conn.execute(
        sa.text(
            "SELECT value FROM settings WHERE key = 'sale.number.prefix' "
            "AND is_deleted = false LIMIT 1"
        )
    ).fetchone()
    prefix = (prefix_row[0] if prefix_row else "SAL").strip().upper() or "SAL"
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
        "sales",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("sale_number", sa.String(length=50), nullable=False),
        sa.Column("origin", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("customer_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("rental_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("return_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("inspection_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("total_amount", sa.BigInteger(), nullable=False),
        sa.Column("sold_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sold_by", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("notes", sa.String(length=2000), nullable=True),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["customers.id"],
            name="fk_sales_customer_id_customers",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["rental_id"],
            ["rentals.id"],
            name="fk_sales_rental_id_rentals",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["return_id"],
            ["returns.id"],
            name="fk_sales_return_id_returns",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["inspection_id"],
            ["inspections.id"],
            name="fk_sales_inspection_id_inspections",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_sales"),
    )
    op.create_index("ix_sales_sale_number", "sales", ["sale_number"])
    op.create_index("ix_sales_origin", "sales", ["origin"])
    op.create_index("ix_sales_status", "sales", ["status"])
    op.create_index("ix_sales_customer_id", "sales", ["customer_id"])
    op.create_index("ix_sales_rental_id", "sales", ["rental_id"])
    op.create_index("ix_sales_return_id", "sales", ["return_id"])
    op.create_index("ix_sales_inspection_id", "sales", ["inspection_id"])
    op.create_index("ix_sales_is_deleted", "sales", ["is_deleted"])
    op.create_index("ix_sales_created_at", "sales", ["created_at"])
    op.create_index(
        "uq_sales_number_alive",
        "sales",
        ["sale_number"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
        sqlite_where=sa.text("is_deleted = 0"),
    )

    op.create_table(
        "sale_items",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("sale_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("dress_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("default_sale_price", sa.BigInteger(), nullable=False),
        sa.Column("actual_sale_price", sa.BigInteger(), nullable=False),
        sa.Column("inspection_item_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("notes", sa.String(length=1000), nullable=True),
        *_immutable_audit_columns(),
        sa.ForeignKeyConstraint(
            ["sale_id"],
            ["sales.id"],
            name="fk_sale_items_sale_id_sales",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["dress_id"],
            ["dresses.id"],
            name="fk_sale_items_dress_id_dresses",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["inspection_item_id"],
            ["inspection_items.id"],
            name="fk_sale_items_inspection_item_id",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_sale_items"),
    )
    op.create_index("ix_sale_items_sale_id", "sale_items", ["sale_id"])
    op.create_index("ix_sale_items_dress_id", "sale_items", ["dress_id"])
    op.create_index("ix_sale_items_inspection_item_id", "sale_items", ["inspection_item_id"])
    op.create_index(
        "uq_sale_items_dress_completed",
        "sale_items",
        ["dress_id"],
        unique=True,
    )
    op.create_index(
        "uq_sale_items_inspection_item",
        "sale_items",
        ["inspection_item_id"],
        unique=True,
        postgresql_where=sa.text("inspection_item_id IS NOT NULL"),
        sqlite_where=sa.text("inspection_item_id IS NOT NULL"),
    )

    op.create_table(
        "sale_payments",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("sale_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("payment_method", sa.String(length=32), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_by", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("reference_number", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.String(length=1000), nullable=True),
        *_immutable_audit_columns(),
        sa.ForeignKeyConstraint(
            ["sale_id"],
            ["sales.id"],
            name="fk_sale_payments_sale_id_sales",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_sale_payments"),
    )
    op.create_index("ix_sale_payments_sale_id", "sale_payments", ["sale_id"])


def downgrade() -> None:
    conn = op.get_bind()

    prefix_row = conn.execute(
        sa.text(
            "SELECT value FROM settings WHERE key = 'sale.number.prefix' "
            "AND is_deleted = false LIMIT 1"
        )
    ).fetchone()
    prefix = (prefix_row[0] if prefix_row else "SAL").strip().upper() or "SAL"
    conn.execute(sa.text("DELETE FROM barcode_counters WHERE prefix = :prefix"), {"prefix": prefix})
    for seed in SALE_NUMBER_SETTINGS:
        conn.execute(sa.text("DELETE FROM settings WHERE key = :key"), {"key": seed["key"]})

    op.drop_index("ix_sale_payments_sale_id", table_name="sale_payments")
    op.drop_table("sale_payments")
    op.drop_index("uq_sale_items_inspection_item", table_name="sale_items")
    op.drop_index("uq_sale_items_dress_completed", table_name="sale_items")
    op.drop_index("ix_sale_items_inspection_item_id", table_name="sale_items")
    op.drop_index("ix_sale_items_dress_id", table_name="sale_items")
    op.drop_index("ix_sale_items_sale_id", table_name="sale_items")
    op.drop_table("sale_items")
    op.drop_index("uq_sales_number_alive", table_name="sales")
    op.drop_index("ix_sales_created_at", table_name="sales")
    op.drop_index("ix_sales_is_deleted", table_name="sales")
    op.drop_index("ix_sales_inspection_id", table_name="sales")
    op.drop_index("ix_sales_return_id", table_name="sales")
    op.drop_index("ix_sales_rental_id", table_name="sales")
    op.drop_index("ix_sales_customer_id", table_name="sales")
    op.drop_index("ix_sales_status", table_name="sales")
    op.drop_index("ix_sales_origin", table_name="sales")
    op.drop_index("ix_sales_sale_number", table_name="sales")
    op.drop_table("sales")
