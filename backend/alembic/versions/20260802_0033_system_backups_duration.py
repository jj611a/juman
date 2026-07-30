"""Add duration fields to system_backups.

Revision ID: 20260802_0033_system_backups_duration
Revises: 20260801_0032_system_maintenance_runs
Create Date: 2026-08-02 00:00:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260802_0033_system_backups_duration"
down_revision: str | None = "20260801_0032_system_maintenance_runs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "system_backups",
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "system_backups",
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "system_backups",
        sa.Column("duration_ms", sa.BigInteger(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("system_backups", "duration_ms")
    op.drop_column("system_backups", "finished_at")
    op.drop_column("system_backups", "started_at")
