"""Create system_restores table.

Revision ID: 20260731_0031_system_restores
Revises: 20260730_0030_system_backups
Create Date: 2026-07-31 00:00:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260731_0031_system_restores"
down_revision: str | None = "20260730_0030_system_backups"
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
        "system_restores",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("source_backup_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("source_filename", sa.String(length=255), nullable=False),
        sa.Column("package_checksum_sha256", sa.String(length=64), nullable=True),
        sa.Column("safety_backup_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("format_version", sa.Integer(), nullable=True),
        sa.Column("app_version", sa.String(length=64), nullable=True),
        sa.Column("alembic_revision", sa.String(length=128), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.BigInteger(), nullable=True),
        sa.Column("created_by_user_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("warning_message", sa.Text(), nullable=True),
        sa.Column("audit_log_id", sa.Uuid(as_uuid=True), nullable=True),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["source_backup_id"],
            ["system_backups.id"],
            name="fk_system_restores_source_backup_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["safety_backup_id"],
            ["system_backups.id"],
            name="fk_system_restores_safety_backup_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["users.id"],
            name="fk_system_restores_created_by_user_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["audit_log_id"],
            ["audit_logs.id"],
            name="fk_system_restores_audit_log_id",
            ondelete="SET NULL",
        ),
    )
    op.create_index("ix_system_restores_status", "system_restores", ["status"])
    op.create_index("ix_system_restores_source_backup_id", "system_restores", ["source_backup_id"])
    op.create_index("ix_system_restores_safety_backup_id", "system_restores", ["safety_backup_id"])
    op.create_index(
        "ix_system_restores_created_by_user_id", "system_restores", ["created_by_user_id"]
    )
    op.create_index("ix_system_restores_is_deleted", "system_restores", ["is_deleted"])
    op.create_index("ix_system_restores_created_by", "system_restores", ["created_by"])
    op.create_index("ix_system_restores_updated_by", "system_restores", ["updated_by"])
    op.create_index("ix_system_restores_deleted_by", "system_restores", ["deleted_by"])


def downgrade() -> None:
    op.drop_index("ix_system_restores_deleted_by", table_name="system_restores")
    op.drop_index("ix_system_restores_updated_by", table_name="system_restores")
    op.drop_index("ix_system_restores_created_by", table_name="system_restores")
    op.drop_index("ix_system_restores_is_deleted", table_name="system_restores")
    op.drop_index("ix_system_restores_created_by_user_id", table_name="system_restores")
    op.drop_index("ix_system_restores_safety_backup_id", table_name="system_restores")
    op.drop_index("ix_system_restores_source_backup_id", table_name="system_restores")
    op.drop_index("ix_system_restores_status", table_name="system_restores")
    op.drop_table("system_restores")
