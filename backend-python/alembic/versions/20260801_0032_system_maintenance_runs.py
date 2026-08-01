"""Create system_maintenance_runs table.

Revision ID: 20260801_0032_system_maintenance_runs
Revises: 20260731_0031_system_restores
Create Date: 2026-08-01 00:00:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260801_0032_system_maintenance_runs"
down_revision: str | None = "20260731_0031_system_restores"
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
        "system_maintenance_runs",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("task_key", sa.String(length=64), nullable=False),
        sa.Column("task_title", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("dry_run", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.BigInteger(), nullable=True),
        sa.Column("executed_by_user_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column(
            "result_details",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("audit_log_id", sa.Uuid(as_uuid=True), nullable=True),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["executed_by_user_id"],
            ["users.id"],
            name="fk_system_maintenance_runs_executed_by_user_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["audit_log_id"],
            ["audit_logs.id"],
            name="fk_system_maintenance_runs_audit_log_id",
            ondelete="SET NULL",
        ),
    )
    op.create_index(
        "ix_system_maintenance_runs_task_key",
        "system_maintenance_runs",
        ["task_key"],
    )
    op.create_index(
        "ix_system_maintenance_runs_status",
        "system_maintenance_runs",
        ["status"],
    )
    op.create_index(
        "ix_system_maintenance_runs_started_at",
        "system_maintenance_runs",
        ["started_at"],
    )
    op.create_index(
        "ix_system_maintenance_runs_executed_by_user_id",
        "system_maintenance_runs",
        ["executed_by_user_id"],
    )
    op.create_index(
        "ix_system_maintenance_runs_is_deleted",
        "system_maintenance_runs",
        ["is_deleted"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_system_maintenance_runs_is_deleted",
        table_name="system_maintenance_runs",
    )
    op.drop_index(
        "ix_system_maintenance_runs_executed_by_user_id",
        table_name="system_maintenance_runs",
    )
    op.drop_index(
        "ix_system_maintenance_runs_started_at",
        table_name="system_maintenance_runs",
    )
    op.drop_index("ix_system_maintenance_runs_status", table_name="system_maintenance_runs")
    op.drop_index("ix_system_maintenance_runs_task_key", table_name="system_maintenance_runs")
    op.drop_table("system_maintenance_runs")
