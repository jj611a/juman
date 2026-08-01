"""Create dresses table (Inventory Phase 1 — Dress asset core).

Revision ID: 20260726_0014_dresses
Revises: 20260726_0013_customers
Create Date: 2026-07-26 19:00:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260726_0014_dresses"
down_revision: str | None = "20260726_0013_customers"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


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
    op.create_table(
        "dresses",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("barcode", sa.String(length=64), nullable=True),
        sa.Column("category_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("name_ar", sa.String(length=200), nullable=False),
        sa.Column("name_en", sa.String(length=200), nullable=True),
        sa.Column("brand", sa.String(length=200), nullable=True),
        sa.Column("size", sa.String(length=20), nullable=False),
        sa.Column("colour", sa.String(length=50), nullable=False),
        sa.Column("purchase_price", sa.BigInteger(), nullable=False),
        sa.Column("default_daily_rental_price", sa.BigInteger(), nullable=False),
        sa.Column("default_sale_price", sa.BigInteger(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("purchase_date", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=32),
            server_default="AVAILABLE",
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
            name="fk_dresses_category_id_categories",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_dresses"),
    )
    op.create_index("ix_dresses_category_id", "dresses", ["category_id"], unique=False)
    op.create_index("ix_dresses_brand", "dresses", ["brand"], unique=False)
    op.create_index("ix_dresses_size", "dresses", ["size"], unique=False)
    op.create_index("ix_dresses_colour", "dresses", ["colour"], unique=False)
    op.create_index("ix_dresses_status", "dresses", ["status"], unique=False)
    op.create_index("ix_dresses_is_active", "dresses", ["is_active"], unique=False)
    op.create_index("ix_dresses_is_deleted", "dresses", ["is_deleted"], unique=False)
    op.create_index("ix_dresses_created_at", "dresses", ["created_at"], unique=False)
    op.create_index("ix_dresses_created_by", "dresses", ["created_by"], unique=False)
    op.create_index("ix_dresses_updated_by", "dresses", ["updated_by"], unique=False)
    op.create_index("ix_dresses_deleted_by", "dresses", ["deleted_by"], unique=False)
    op.create_index(
        "uq_dresses_barcode_alive",
        "dresses",
        ["barcode"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false AND barcode IS NOT NULL"),
        sqlite_where=sa.text("is_deleted = 0 AND barcode IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_dresses_barcode_alive", table_name="dresses")
    op.drop_index("ix_dresses_deleted_by", table_name="dresses")
    op.drop_index("ix_dresses_updated_by", table_name="dresses")
    op.drop_index("ix_dresses_created_by", table_name="dresses")
    op.drop_index("ix_dresses_created_at", table_name="dresses")
    op.drop_index("ix_dresses_is_deleted", table_name="dresses")
    op.drop_index("ix_dresses_is_active", table_name="dresses")
    op.drop_index("ix_dresses_status", table_name="dresses")
    op.drop_index("ix_dresses_colour", table_name="dresses")
    op.drop_index("ix_dresses_size", table_name="dresses")
    op.drop_index("ix_dresses_brand", table_name="dresses")
    op.drop_index("ix_dresses_category_id", table_name="dresses")
    op.drop_table("dresses")
