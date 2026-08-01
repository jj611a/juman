"""Bind refresh tokens to login_sessions (Identity Phase 4).

Revision ID: 20260726_0008_login_sessions
Revises: 20260726_0007_refresh_tokens
Create Date: 2026-07-26 17:40:00
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "20260726_0008_login_sessions"
down_revision: str | None = "20260726_0007_refresh_tokens"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SESSION_SETTINGS: tuple[dict[str, object], ...] = (
    {
        "key": "remember_me_refresh_token_expire_days",
        "value": 30,
        "value_type": "integer",
        "category": "system",
        "description": "مدة صلاحية رمز التحديث عند تفعيل تذكرني بالأيام",
        "is_editable": True,
    },
)


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


def _serialize(value: object, value_type: str) -> str:
    if value_type == "boolean":
        return "true" if value else "false"
    return str(value)


def upgrade() -> None:
    op.create_table(
        "login_sessions",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("device_name", sa.String(length=150), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_by", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column(
            "remember_me",
            sa.Boolean(),
            server_default="false",
            nullable=False,
        ),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_login_sessions_user_id_users",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_login_sessions"),
    )
    op.create_index("ix_login_sessions_user_id", "login_sessions", ["user_id"], unique=False)
    op.create_index("ix_login_sessions_expires_at", "login_sessions", ["expires_at"], unique=False)

    op.add_column(
        "refresh_tokens",
        sa.Column("session_id", sa.Uuid(as_uuid=True), nullable=True),
    )

    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            """
            SELECT id, user_id, device_name, ip_address, expires_at,
                   created_at, updated_at, created_by, updated_by
            FROM refresh_tokens
            WHERE session_id IS NULL
            """
        )
    ).fetchall()
    now = datetime.now(UTC)
    for row in rows:
        session_id = uuid4()
        conn.execute(
            sa.text(
                """
                INSERT INTO login_sessions (
                    id, user_id, device_name, ip_address, last_activity_at, expires_at,
                    revoked_at, revoked_by, remember_me,
                    created_at, updated_at, created_by, updated_by,
                    is_deleted, deleted_at, deleted_by
                ) VALUES (
                    :id, :user_id, :device_name, :ip_address, :last_activity_at, :expires_at,
                    NULL, NULL, false,
                    :created_at, :updated_at, :created_by, :updated_by,
                    false, NULL, NULL
                )
                """
            ),
            {
                "id": str(session_id),
                "user_id": str(row.user_id),
                "device_name": row.device_name,
                "ip_address": row.ip_address,
                "last_activity_at": row.updated_at or now,
                "expires_at": row.expires_at,
                "created_at": row.created_at or now,
                "updated_at": row.updated_at or now,
                "created_by": str(row.created_by) if row.created_by else None,
                "updated_by": str(row.updated_by) if row.updated_by else None,
            },
        )
        conn.execute(
            sa.text("UPDATE refresh_tokens SET session_id = :session_id WHERE id = :id"),
            {"session_id": str(session_id), "id": str(row.id)},
        )

    op.alter_column("refresh_tokens", "session_id", nullable=False)
    op.create_foreign_key(
        "fk_refresh_tokens_session_id_login_sessions",
        "refresh_tokens",
        "login_sessions",
        ["session_id"],
        ["id"],
    )
    op.create_index("ix_refresh_tokens_session_id", "refresh_tokens", ["session_id"], unique=False)

    op.drop_column("refresh_tokens", "device_name")
    op.drop_column("refresh_tokens", "ip_address")

    for seed in SESSION_SETTINGS:
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
    for seed in SESSION_SETTINGS:
        conn.execute(
            sa.text("DELETE FROM settings WHERE key = :key"),
            {"key": seed["key"]},
        )

    op.add_column(
        "refresh_tokens",
        sa.Column("device_name", sa.String(length=150), nullable=True),
    )
    op.add_column(
        "refresh_tokens",
        sa.Column("ip_address", sa.String(length=64), nullable=True),
    )
    conn.execute(
        sa.text(
            """
            UPDATE refresh_tokens AS rt
            SET device_name = ls.device_name,
                ip_address = ls.ip_address
            FROM login_sessions AS ls
            WHERE rt.session_id = ls.id
            """
        )
    )

    op.drop_index("ix_refresh_tokens_session_id", table_name="refresh_tokens")
    op.drop_constraint(
        "fk_refresh_tokens_session_id_login_sessions",
        "refresh_tokens",
        type_="foreignkey",
    )
    op.drop_column("refresh_tokens", "session_id")

    op.drop_index("ix_login_sessions_expires_at", table_name="login_sessions")
    op.drop_index("ix_login_sessions_user_id", table_name="login_sessions")
    op.drop_table("login_sessions")
