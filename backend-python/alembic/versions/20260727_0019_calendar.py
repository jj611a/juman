"""Create dress_calendar_blocks table (Calendar Engine).

Revision ID: 20260727_0019_calendar
Revises: 20260727_0018_dress_search
Create Date: 2026-07-27 01:10:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260727_0019_calendar"
down_revision: str | None = "20260727_0018_dress_search"
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
        "dress_calendar_blocks",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("dress_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("block_type", sa.String(length=32), nullable=False),
        sa.Column("reference_module", sa.String(length=50), nullable=True),
        sa.Column("reference_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.String(length=1000), nullable=True),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["dress_id"],
            ["dresses.id"],
            name="fk_dress_calendar_blocks_dress_id_dresses",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_dress_calendar_blocks"),
    )
    op.create_index(
        "ix_dress_calendar_blocks_dress_id",
        "dress_calendar_blocks",
        ["dress_id"],
        unique=False,
    )
    op.create_index(
        "ix_dress_calendar_blocks_dress_id_start_at",
        "dress_calendar_blocks",
        ["dress_id", "start_at"],
        unique=False,
    )
    op.create_index(
        "ix_dress_calendar_blocks_dress_id_end_at",
        "dress_calendar_blocks",
        ["dress_id", "end_at"],
        unique=False,
    )
    op.create_index(
        "ix_dress_calendar_blocks_block_type",
        "dress_calendar_blocks",
        ["block_type"],
        unique=False,
    )
    op.create_index(
        "ix_dress_calendar_blocks_is_deleted",
        "dress_calendar_blocks",
        ["is_deleted"],
        unique=False,
    )
    op.create_index(
        "ix_dress_calendar_blocks_created_at",
        "dress_calendar_blocks",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        "ix_dress_calendar_blocks_created_by",
        "dress_calendar_blocks",
        ["created_by"],
        unique=False,
    )
    op.create_index(
        "ix_dress_calendar_blocks_updated_by",
        "dress_calendar_blocks",
        ["updated_by"],
        unique=False,
    )
    op.create_index(
        "ix_dress_calendar_blocks_deleted_by",
        "dress_calendar_blocks",
        ["deleted_by"],
        unique=False,
    )
    op.create_index(
        "ix_dress_calendar_blocks_reference_id",
        "dress_calendar_blocks",
        ["reference_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_dress_calendar_blocks_reference_id", table_name="dress_calendar_blocks")
    op.drop_index("ix_dress_calendar_blocks_deleted_by", table_name="dress_calendar_blocks")
    op.drop_index("ix_dress_calendar_blocks_updated_by", table_name="dress_calendar_blocks")
    op.drop_index("ix_dress_calendar_blocks_created_by", table_name="dress_calendar_blocks")
    op.drop_index("ix_dress_calendar_blocks_created_at", table_name="dress_calendar_blocks")
    op.drop_index("ix_dress_calendar_blocks_is_deleted", table_name="dress_calendar_blocks")
    op.drop_index("ix_dress_calendar_blocks_block_type", table_name="dress_calendar_blocks")
    op.drop_index("ix_dress_calendar_blocks_dress_id_end_at", table_name="dress_calendar_blocks")
    op.drop_index("ix_dress_calendar_blocks_dress_id_start_at", table_name="dress_calendar_blocks")
    op.drop_index("ix_dress_calendar_blocks_dress_id", table_name="dress_calendar_blocks")
    op.drop_table("dress_calendar_blocks")
