"""Create identity tables, seed security settings, unlock permission, optional bootstrap.

Revision ID: 20260726_0003_identity
Revises: 20260726_0002_rbac
Create Date: 2026-07-26 12:00:00
"""

from __future__ import annotations

import json
import os
from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "20260726_0003_identity"
down_revision: str | None = "20260726_0002_rbac"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _serialize(value: object, value_type: str) -> str:
    if value_type == "boolean":
        return "true" if bool(value) else "false"
    if value_type == "json":
        return json.dumps(value, ensure_ascii=False)
    return str(value)


IDENTITY_SETTINGS: list[dict[str, object]] = [
    {
        "key": "max_failed_login_attempts",
        "value": 5,
        "value_type": "integer",
        "category": "system",
        "description": "الحد الأقصى لمحاولات تسجيل الدخول الفاشلة قبل القفل",
        "is_editable": True,
    },
    {
        "key": "account_lock_duration_minutes",
        "value": 0,
        "value_type": "integer",
        "category": "system",
        "description": "مدة قفل الحساب بالدقائق (0 = حتى يفتحه المسؤول)",
        "is_editable": True,
    },
    {
        "key": "password_min_length",
        "value": 10,
        "value_type": "integer",
        "category": "system",
        "description": "الحد الأدنى لطول كلمة المرور",
        "is_editable": True,
    },
    {
        "key": "password_require_complexity",
        "value": True,
        "value_type": "boolean",
        "category": "system",
        "description": "اشتراط تعقيد كلمة المرور (3 من 4 فئات)",
        "is_editable": True,
    },
    {
        "key": "password_history_count",
        "value": 5,
        "value_type": "integer",
        "category": "system",
        "description": "عدد كلمات المرور السابقة الممنوع إعادة استخدامها",
        "is_editable": True,
    },
    {
        "key": "access_token_expire_minutes",
        "value": 60,
        "value_type": "integer",
        "category": "system",
        "description": "مدة صلاحية رمز الوصول بالدقائق",
        "is_editable": True,
    },
    {
        "key": "refresh_token_expire_days",
        "value": 7,
        "value_type": "integer",
        "category": "system",
        "description": "مدة صلاحية رمز التحديث بالأيام",
        "is_editable": True,
    },
]


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
        "users",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=200), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("is_locked", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("must_change_password", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("failed_login_attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        *_audit_columns(),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=False)
    op.create_index("ix_users_is_active", "users", ["is_active"], unique=False)
    op.create_index("ix_users_is_locked", "users", ["is_locked"], unique=False)
    op.create_index("ix_users_is_deleted", "users", ["is_deleted"], unique=False)
    op.create_index(
        "uq_users_username_active",
        "users",
        ["username"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
        sqlite_where=sa.text("is_deleted = 0"),
    )

    op.create_table(
        "user_roles",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("role_id", sa.Uuid(as_uuid=True), nullable=False),
        *_audit_columns(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_user_roles_user_id_users"),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], name="fk_user_roles_role_id_roles"),
        sa.PrimaryKeyConstraint("id", name="pk_user_roles"),
    )
    op.create_index("ix_user_roles_user_id", "user_roles", ["user_id"], unique=False)
    op.create_index("ix_user_roles_role_id", "user_roles", ["role_id"], unique=False)
    op.create_index("ix_user_roles_is_deleted", "user_roles", ["is_deleted"], unique=False)
    op.create_index(
        "uq_user_roles_user_role_active",
        "user_roles",
        ["user_id", "role_id"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
        sqlite_where=sa.text("is_deleted = 0"),
    )

    op.create_table(
        "login_sessions",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("device_label", sa.String(length=150), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_by", sa.Uuid(as_uuid=True), nullable=True),
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

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("session_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("replaced_by_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["login_sessions.id"],
            name="fk_refresh_tokens_session_id_login_sessions",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_refresh_tokens_user_id_users"),
        sa.ForeignKeyConstraint(
            ["replaced_by_id"],
            ["refresh_tokens.id"],
            name="fk_refresh_tokens_replaced_by_id",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_refresh_tokens"),
        sa.UniqueConstraint("token_hash", name="uq_refresh_tokens_token_hash"),
    )
    op.create_index("ix_refresh_tokens_session_id", "refresh_tokens", ["session_id"], unique=False)
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"], unique=False)
    op.create_index("ix_refresh_tokens_expires_at", "refresh_tokens", ["expires_at"], unique=False)

    op.create_table(
        "login_history",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("username_attempted", sa.String(length=100), nullable=False),
        sa.Column("result", sa.String(length=20), nullable=False),
        sa.Column("failure_reason", sa.String(length=50), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("device_label", sa.String(length=150), nullable=True),
        sa.Column("session_id", sa.Uuid(as_uuid=True), nullable=True),
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
        sa.PrimaryKeyConstraint("id", name="pk_login_history"),
    )
    op.create_index("ix_login_history_user_id", "login_history", ["user_id"], unique=False)
    op.create_index(
        "ix_login_history_username_attempted",
        "login_history",
        ["username_attempted"],
        unique=False,
    )
    op.create_index("ix_login_history_result", "login_history", ["result"], unique=False)

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
        sa.Column(
            "updated_at",
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

    now = datetime.now(UTC)
    conn = op.get_bind()
    for seed in IDENTITY_SETTINGS:
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

    conn.execute(
        sa.text(
            """
            INSERT INTO permissions (
                id, key, display_name, description, module,
                created_at, updated_at, created_by, updated_by,
                is_deleted, deleted_at, deleted_by
            )
            SELECT
                :id, 'users.unlock', :display_name, :description, 'users',
                :created_at, :updated_at, NULL, NULL,
                false, NULL, NULL
            WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE key = 'users.unlock')
            """
        ),
        {
            "id": str(uuid4()),
            "display_name": "فتح حساب مقفل",
            "description": "إلغاء قفل حساب مستخدم",
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
              AND p.key = 'users.unlock'
              AND NOT EXISTS (
                  SELECT 1 FROM role_permissions rp
                  WHERE rp.role_id = r.id AND rp.permission_id = p.id
              )
            """
        ),
        {"id": str(uuid4()), "created_at": now, "updated_at": now},
    )

    _maybe_bootstrap_admin(conn, now)


def _maybe_bootstrap_admin(conn: sa.Connection, now: datetime) -> None:
    username = os.environ.get("IDENTITY_BOOTSTRAP_USERNAME", "").strip().lower()
    password = os.environ.get("IDENTITY_BOOTSTRAP_PASSWORD", "")
    if not username or not password:
        return

    existing = conn.execute(sa.text("SELECT COUNT(*) FROM users")).scalar()
    if existing and int(existing) > 0:
        return

    from app.security.password import hash_password

    user_id = uuid4()
    password_hash = hash_password(password)
    conn.execute(
        sa.text(
            """
            INSERT INTO users (
                id, username, password_hash, full_name, phone, email,
                is_active, is_locked, must_change_password, failed_login_attempts,
                locked_until, last_login_at, password_changed_at, notes,
                created_at, updated_at, created_by, updated_by,
                is_deleted, deleted_at, deleted_by
            ) VALUES (
                :id, :username, :password_hash, :full_name, NULL, NULL,
                true, false, true, 0,
                NULL, NULL, :password_changed_at, NULL,
                :created_at, :updated_at, NULL, NULL,
                false, NULL, NULL
            )
            """
        ),
        {
            "id": str(user_id),
            "username": username,
            "password_hash": password_hash,
            "full_name": "System Administrator",
            "password_changed_at": now,
            "created_at": now,
            "updated_at": now,
        },
    )
    conn.execute(
        sa.text(
            """
            INSERT INTO user_roles (
                id, user_id, role_id,
                created_at, updated_at, created_by, updated_by,
                is_deleted, deleted_at, deleted_by
            )
            SELECT
                :id, :user_id, r.id,
                :created_at, :updated_at, NULL, NULL,
                false, NULL, NULL
            FROM roles r
            WHERE r.name = 'Admin'
            """
        ),
        {
            "id": str(uuid4()),
            "user_id": str(user_id),
            "created_at": now,
            "updated_at": now,
        },
    )
    conn.execute(
        sa.text(
            """
            INSERT INTO password_history (id, user_id, password_hash, created_at, updated_at)
            VALUES (:id, :user_id, :password_hash, :created_at, :updated_at)
            """
        ),
        {
            "id": str(uuid4()),
            "user_id": str(user_id),
            "password_hash": password_hash,
            "created_at": now,
            "updated_at": now,
        },
    )


def downgrade() -> None:
    op.drop_table("password_history")
    op.drop_table("login_history")
    op.drop_table("refresh_tokens")
    op.drop_table("login_sessions")
    op.drop_table("user_roles")
    op.drop_table("users")

    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            DELETE FROM role_permissions
            WHERE permission_id IN (SELECT id FROM permissions WHERE key = 'users.unlock')
            """
        )
    )
    conn.execute(sa.text("DELETE FROM permissions WHERE key = 'users.unlock'"))
    for seed in IDENTITY_SETTINGS:
        conn.execute(
            sa.text("DELETE FROM settings WHERE key = :key"),
            {"key": seed["key"]},
        )
