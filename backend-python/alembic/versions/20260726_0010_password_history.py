"""Recreate password_history and seed password_expire_days (Identity Phase 6).

Revision ID: 20260726_0010_password_history
Revises: 20260726_0009_login_history
Create Date: 2026-07-26 18:00:00
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "20260726_0010_password_history"
down_revision: str | None = "20260726_0009_login_history"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PASSWORD_SETTINGS: tuple[dict[str, object], ...] = (
    {
        "key": "password_expire_days",
        "value": 0,
        "value_type": "integer",
        "category": "system",
        "description": "عدد الأيام قبل انتهاء صلاحية كلمة المرور (0 = معطّل)",
        "is_editable": True,
    },
)


def _serialize(value: object, value_type: str) -> str:
    if value_type == "boolean":
        return "true" if value else "false"
    return str(value)


def upgrade() -> None:
    op.create_table(
        "password_history",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_password_history_user_id_users",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_password_history"),
    )
    op.create_index("ix_password_history_user_id", "password_history", ["user_id"], unique=False)
    op.create_index(
        "ix_password_history_created_at",
        "password_history",
        ["created_at"],
        unique=False,
    )

    conn = op.get_bind()
    now = datetime.now(UTC)
    rows = conn.execute(
        sa.text(
            """
            SELECT u.id, u.password_hash, u.password_changed_at
            FROM users u
            WHERE u.password_hash IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM password_history ph WHERE ph.user_id = u.id
              )
            """
        )
    ).fetchall()
    for row in rows:
        conn.execute(
            sa.text(
                """
                INSERT INTO password_history (id, user_id, password_hash, created_at)
                VALUES (:id, :user_id, :password_hash, :created_at)
                """
            ),
            {
                "id": str(uuid4()),
                "user_id": str(row.id),
                "password_hash": row.password_hash,
                "created_at": row.password_changed_at or now,
            },
        )

    for seed in PASSWORD_SETTINGS:
        value_type = str(seed["value_type"])
        conn.execute(
            sa.text(
                """
                INSERT INTO settings (
                    id, key, value, value_type, category, description, is_editable,
                    created_at, updated_at, created_by, updated_by,
                    is_deleted, deleted_at, deleted_by
                )
                SELECT
                    :id, :key, :value, :value_type, :category, :description, :is_editable,
                    :created_at, :updated_at, NULL, NULL,
                    false, NULL, NULL
                WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = :lookup_key)
                """
            ),
            {
                "id": str(uuid4()),
                "key": seed["key"],
                "lookup_key": seed["key"],
                "value": _serialize(seed["value"], value_type),
                "value_type": value_type,
                "category": seed["category"],
                "description": seed["description"],
                "is_editable": bool(seed["is_editable"]),
                "created_at": now,
                "updated_at": now,
            },
        )


def downgrade() -> None:
    conn = op.get_bind()
    for seed in PASSWORD_SETTINGS:
        conn.execute(
            sa.text("DELETE FROM settings WHERE key = :key"),
            {"key": seed["key"]},
        )
    op.drop_index("ix_password_history_created_at", table_name="password_history")
    op.drop_index("ix_password_history_user_id", table_name="password_history")
    op.drop_table("password_history")
