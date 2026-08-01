"""Add dress search indexes; widen alembic_version for long revision ids.

Revision ID: 20260727_0018_dress_search
Revises: 20260726_0017_dress_photos
Create Date: 2026-07-27 00:30:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260727_0018_dress_search"
down_revision: str | None = "20260726_0017_dress_photos"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Default alembic_version.version_num is VARCHAR(32); several Juman revision
    # ids approach that limit. Widen before recording this revision.
    op.execute("ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(64)")

    op.create_index("ix_dresses_updated_at", "dresses", ["updated_at"], unique=False)
    op.create_index("ix_dresses_purchase_price", "dresses", ["purchase_price"], unique=False)
    op.create_index(
        "ix_dresses_default_daily_rental_price",
        "dresses",
        ["default_daily_rental_price"],
        unique=False,
    )
    op.create_index(
        "ix_dresses_default_sale_price",
        "dresses",
        ["default_sale_price"],
        unique=False,
    )
    op.create_index("ix_dresses_name_ar", "dresses", ["name_ar"], unique=False)
    op.create_index(
        "ix_dresses_alive_status_active",
        "dresses",
        ["status", "is_active"],
        unique=False,
        postgresql_where=sa.text("is_deleted = false"),
        sqlite_where=sa.text("is_deleted = 0"),
    )


def downgrade() -> None:
    op.drop_index("ix_dresses_alive_status_active", table_name="dresses")
    op.drop_index("ix_dresses_name_ar", table_name="dresses")
    op.drop_index("ix_dresses_default_sale_price", table_name="dresses")
    op.drop_index("ix_dresses_default_daily_rental_price", table_name="dresses")
    op.drop_index("ix_dresses_purchase_price", table_name="dresses")
    op.drop_index("ix_dresses_updated_at", table_name="dresses")
