"""Create dress_photos table (Inventory Phase 3 — Photo Management).

Revision ID: 20260726_0017_dress_photos
Revises: 20260726_0016_customers_v2
Create Date: 2026-07-26 21:00:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260726_0017_dress_photos"
down_revision: str | None = "20260726_0016_customers_v2"
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
        "dress_photos",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("dress_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("stored_file_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("display_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_cover", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("caption", sa.String(length=500), nullable=True),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["dress_id"],
            ["dresses.id"],
            name="fk_dress_photos_dress_id_dresses",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["stored_file_id"],
            ["stored_files.id"],
            name="fk_dress_photos_stored_file_id_stored_files",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_dress_photos"),
    )
    op.create_index("ix_dress_photos_dress_id", "dress_photos", ["dress_id"], unique=False)
    op.create_index(
        "ix_dress_photos_stored_file_id",
        "dress_photos",
        ["stored_file_id"],
        unique=False,
    )
    op.create_index(
        "ix_dress_photos_dress_id_display_order",
        "dress_photos",
        ["dress_id", "display_order"],
        unique=False,
    )
    op.create_index("ix_dress_photos_is_deleted", "dress_photos", ["is_deleted"], unique=False)
    op.create_index("ix_dress_photos_created_at", "dress_photos", ["created_at"], unique=False)
    op.create_index("ix_dress_photos_created_by", "dress_photos", ["created_by"], unique=False)
    op.create_index("ix_dress_photos_updated_by", "dress_photos", ["updated_by"], unique=False)
    op.create_index("ix_dress_photos_deleted_by", "dress_photos", ["deleted_by"], unique=False)
    op.create_index(
        "uq_dress_photos_cover_alive",
        "dress_photos",
        ["dress_id"],
        unique=True,
        postgresql_where=sa.text("is_cover = true AND is_deleted = false"),
        sqlite_where=sa.text("is_cover = 1 AND is_deleted = 0"),
    )


def downgrade() -> None:
    op.drop_index("uq_dress_photos_cover_alive", table_name="dress_photos")
    op.drop_index("ix_dress_photos_deleted_by", table_name="dress_photos")
    op.drop_index("ix_dress_photos_updated_by", table_name="dress_photos")
    op.drop_index("ix_dress_photos_created_by", table_name="dress_photos")
    op.drop_index("ix_dress_photos_created_at", table_name="dress_photos")
    op.drop_index("ix_dress_photos_is_deleted", table_name="dress_photos")
    op.drop_index("ix_dress_photos_dress_id_display_order", table_name="dress_photos")
    op.drop_index("ix_dress_photos_stored_file_id", table_name="dress_photos")
    op.drop_index("ix_dress_photos_dress_id", table_name="dress_photos")
    op.drop_table("dress_photos")
