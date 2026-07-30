"""Create categories table (Categories module).

Revision ID: 20260726_0012_categories
Revises: 20260726_0011_audit
Create Date: 2026-07-26 18:40:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260726_0012_categories"
down_revision: str | None = "20260726_0011_audit"
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
        "categories",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("name_ar", sa.String(length=200), nullable=False),
        sa.Column("name_en", sa.String(length=200), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("display_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        *_audit_columns(),
        sa.PrimaryKeyConstraint("id", name="pk_categories"),
    )
    op.create_index("ix_categories_display_order", "categories", ["display_order"], unique=False)
    op.create_index("ix_categories_is_active", "categories", ["is_active"], unique=False)
    op.create_index("ix_categories_created_at", "categories", ["created_at"], unique=False)
    op.create_index("ix_categories_is_deleted", "categories", ["is_deleted"], unique=False)
    op.create_index("ix_categories_created_by", "categories", ["created_by"], unique=False)
    op.create_index("ix_categories_updated_by", "categories", ["updated_by"], unique=False)
    op.create_index("ix_categories_deleted_by", "categories", ["deleted_by"], unique=False)
    op.create_index(
        "uq_categories_name_ar_alive",
        "categories",
        ["name_ar"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
        sqlite_where=sa.text("is_deleted = 0"),
    )


def downgrade() -> None:
    op.drop_index("uq_categories_name_ar_alive", table_name="categories")
    op.drop_index("ix_categories_deleted_by", table_name="categories")
    op.drop_index("ix_categories_updated_by", table_name="categories")
    op.drop_index("ix_categories_created_by", table_name="categories")
    op.drop_index("ix_categories_is_deleted", table_name="categories")
    op.drop_index("ix_categories_created_at", table_name="categories")
    op.drop_index("ix_categories_is_active", table_name="categories")
    op.drop_index("ix_categories_display_order", table_name="categories")
    op.drop_table("categories")
