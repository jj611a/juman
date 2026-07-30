"""Add locked_until for authentication lockout duration (Identity Phase 2).

Revision ID: 20260726_0006_auth_engine
Revises: 20260726_0005_identity_phase1
Create Date: 2026-07-26 17:20:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260726_0006_auth_engine"
down_revision: str | None = "20260726_0005_identity_phase1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "locked_until")
