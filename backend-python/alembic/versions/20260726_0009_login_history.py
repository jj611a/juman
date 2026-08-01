"""Create login_history table and seed users.view_login_history (Identity Phase 5).

Revision ID: 20260726_0009_login_history
Revises: 20260726_0008_login_sessions
Create Date: 2026-07-26 17:50:00
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "20260726_0009_login_history"
down_revision: str | None = "20260726_0008_login_sessions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LOGIN_HISTORY_PERMISSIONS: tuple[dict[str, str], ...] = (
    {
        "key": "users.view_login_history",
        "display_name": "عرض سجل الدخول",
        "description": "عرض سجل محاولات الدخول والأحداث الأمنية المرتبطة",
        "module": "users",
    },
)


def upgrade() -> None:
    op.create_table(
        "login_history",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("username_attempted", sa.String(length=100), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("failure_reason", sa.String(length=50), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("device_name", sa.String(length=150), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("session_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_login_history"),
    )
    op.create_index("ix_login_history_user_id", "login_history", ["user_id"], unique=False)
    op.create_index(
        "ix_login_history_username_attempted",
        "login_history",
        ["username_attempted"],
        unique=False,
    )
    op.create_index("ix_login_history_event_type", "login_history", ["event_type"], unique=False)
    op.create_index("ix_login_history_success", "login_history", ["success"], unique=False)
    op.create_index("ix_login_history_created_at", "login_history", ["created_at"], unique=False)
    op.create_index(
        "ix_login_history_user_id_created_at",
        "login_history",
        ["user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_login_history_username_created_at",
        "login_history",
        ["username_attempted", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_login_history_event_type_created_at",
        "login_history",
        ["event_type", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_login_history_success_created_at",
        "login_history",
        ["success", "created_at"],
        unique=False,
    )

    now = datetime.now(UTC)
    conn = op.get_bind()
    for perm in LOGIN_HISTORY_PERMISSIONS:
        conn.execute(
            sa.text(
                """
                INSERT INTO permissions (
                    id, key, display_name, description, module,
                    created_at, updated_at, created_by, updated_by,
                    is_deleted, deleted_at, deleted_by
                )
                SELECT
                    :id, :key, :display_name, :description, :module,
                    :created_at, :updated_at, NULL, NULL,
                    false, NULL, NULL
                WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE key = :lookup_key)
                """
            ),
            {
                "id": str(uuid4()),
                "key": perm["key"],
                "lookup_key": perm["key"],
                "display_name": perm["display_name"],
                "description": perm["description"],
                "module": perm["module"],
                "created_at": now,
                "updated_at": now,
            },
        )
        conn.execute(
            sa.text(
                """
                INSERT INTO role_permissions (
                    id, role_id, permission_id,
                    created_at, updated_at, created_by, updated_by,
                    is_deleted, deleted_at, deleted_by
                )
                SELECT
                    :id, r.id, p.id,
                    :created_at, :updated_at, NULL, NULL,
                    false, NULL, NULL
                FROM roles r
                CROSS JOIN permissions p
                WHERE r.name = 'Admin'
                  AND p.key = :key
                  AND NOT EXISTS (
                      SELECT 1 FROM role_permissions rp
                      WHERE rp.role_id = r.id AND rp.permission_id = p.id
                        AND rp.is_deleted = false
                  )
                """
            ),
            {
                "id": str(uuid4()),
                "key": perm["key"],
                "created_at": now,
                "updated_at": now,
            },
        )


def downgrade() -> None:
    conn = op.get_bind()
    for perm in LOGIN_HISTORY_PERMISSIONS:
        conn.execute(
            sa.text(
                """
                DELETE FROM role_permissions
                WHERE permission_id IN (SELECT id FROM permissions WHERE key = :key)
                """
            ),
            {"key": perm["key"]},
        )
        conn.execute(
            sa.text("DELETE FROM permissions WHERE key = :key"),
            {"key": perm["key"]},
        )

    op.drop_index("ix_login_history_success_created_at", table_name="login_history")
    op.drop_index("ix_login_history_event_type_created_at", table_name="login_history")
    op.drop_index("ix_login_history_username_created_at", table_name="login_history")
    op.drop_index("ix_login_history_user_id_created_at", table_name="login_history")
    op.drop_index("ix_login_history_created_at", table_name="login_history")
    op.drop_index("ix_login_history_success", table_name="login_history")
    op.drop_index("ix_login_history_event_type", table_name="login_history")
    op.drop_index("ix_login_history_username_attempted", table_name="login_history")
    op.drop_index("ix_login_history_user_id", table_name="login_history")
    op.drop_table("login_history")
