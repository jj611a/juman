"""Create migration to reshape Identity to Phase 1 (singular role_id, drop auth tables).

Revision ID: 20260726_0005_identity_phase1
Revises: 20260726_0004_media
Create Date: 2026-07-26 14:40:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260726_0005_identity_phase1"
down_revision: str | None = "20260726_0004_media"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("role_id", sa.Uuid(as_uuid=True), nullable=True))

    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE users u
            SET role_id = sub.role_id
            FROM (
                SELECT DISTINCT ON (user_id) user_id, role_id
                FROM user_roles
                WHERE is_deleted = false
                ORDER BY user_id, created_at ASC
            ) AS sub
            WHERE u.id = sub.user_id
            """
        )
    )
    # Any user without a role gets Admin if present.
    conn.execute(
        sa.text(
            """
            UPDATE users
            SET role_id = (SELECT id FROM roles WHERE name = 'Admin' LIMIT 1)
            WHERE role_id IS NULL
            """
        )
    )
    conn.execute(
        sa.text(
            """
            UPDATE users
            SET full_name = username
            WHERE full_name IS NULL OR TRIM(full_name) = ''
            """
        )
    )

    op.alter_column("users", "role_id", nullable=False)
    op.alter_column("users", "full_name", existing_type=sa.String(length=200), nullable=False)
    op.create_index("ix_users_role_id", "users", ["role_id"])
    op.create_foreign_key(
        "fk_users_role_id_roles",
        "users",
        "roles",
        ["role_id"],
        ["id"],
    )

    op.drop_table("password_history")
    op.drop_table("login_history")
    op.drop_table("refresh_tokens")
    op.drop_table("login_sessions")
    op.drop_table("user_roles")

    # Drop columns no longer in Phase 1 User model.
    op.drop_column("users", "locked_until")
    op.drop_column("users", "notes")


def downgrade() -> None:
    raise NotImplementedError(
        "Downgrade from Identity Phase 1 reshape is not supported; restore from backup."
    )
