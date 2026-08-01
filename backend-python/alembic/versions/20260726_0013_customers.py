"""Create customers table (Customers module).

Revision ID: 20260726_0013_customers
Revises: 20260726_0012_categories
Create Date: 2026-07-26 18:50:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260726_0013_customers"
down_revision: str | None = "20260726_0012_categories"
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
        "customers",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("national_id", sa.String(length=50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        *_audit_columns(),
        sa.PrimaryKeyConstraint("id", name="pk_customers"),
    )
    op.create_index("ix_customers_full_name", "customers", ["full_name"], unique=False)
    op.create_index("ix_customers_phone", "customers", ["phone"], unique=False)
    op.create_index("ix_customers_national_id", "customers", ["national_id"], unique=False)
    op.create_index("ix_customers_is_active", "customers", ["is_active"], unique=False)
    op.create_index("ix_customers_is_deleted", "customers", ["is_deleted"], unique=False)
    op.create_index("ix_customers_created_at", "customers", ["created_at"], unique=False)
    op.create_index("ix_customers_created_by", "customers", ["created_by"], unique=False)
    op.create_index("ix_customers_updated_by", "customers", ["updated_by"], unique=False)
    op.create_index("ix_customers_deleted_by", "customers", ["deleted_by"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_customers_deleted_by", table_name="customers")
    op.drop_index("ix_customers_updated_by", table_name="customers")
    op.drop_index("ix_customers_created_by", table_name="customers")
    op.drop_index("ix_customers_created_at", table_name="customers")
    op.drop_index("ix_customers_is_deleted", table_name="customers")
    op.drop_index("ix_customers_is_active", table_name="customers")
    op.drop_index("ix_customers_national_id", table_name="customers")
    op.drop_index("ix_customers_phone", table_name="customers")
    op.drop_index("ix_customers_full_name", table_name="customers")
    op.drop_table("customers")
