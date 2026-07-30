"""Create system_backups table; seed backup.* settings.

Revision ID: 20260730_0030_system_backups
Revises: 20260729_0029_system_admin
Create Date: 2026-07-30 00:00:00
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "20260730_0030_system_backups"
down_revision: str | None = "20260729_0029_system_admin"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

BACKUP_SETTINGS: tuple[dict[str, object], ...] = (
    {
        "key": "backup.storage_root",
        "value": "./storage/backups",
        "value_type": "string",
        "category": "system",
        "description": "مسار تخزين ملفات النسخ الاحتياطي",
        "is_editable": True,
    },
    {
        "key": "backup.include_media_default",
        "value": False,
        "value_type": "boolean",
        "category": "system",
        "description": "تضمين الوسائط افتراضياً عند إنشاء نسخة احتياطية",
        "is_editable": True,
    },
)


def _serialize(value: object, value_type: str) -> str:
    if value_type == "boolean":
        return "true" if value else "false"
    return str(value)


def _upsert_setting(conn, seed: dict[str, object], *, now: datetime) -> None:
    key = str(seed["key"])
    existing = conn.execute(
        sa.text("SELECT id FROM settings WHERE key = :key AND is_deleted = false LIMIT 1"),
        {"key": key},
    ).fetchone()
    if existing is not None:
        return
    conn.execute(
        sa.text(
            """
            INSERT INTO settings (
                id, key, value, value_type, category, description,
                is_editable, created_at, updated_at, is_deleted
            ) VALUES (
                :id, :key, :value, :value_type, :category, :description,
                :is_editable, :created_at, :updated_at, false
            )
            """
        ),
        {
            "id": str(uuid4()),
            "key": key,
            "value": _serialize(seed["value"], str(seed["value_type"])),
            "value_type": str(seed["value_type"]),
            "category": str(seed["category"]),
            "description": seed["description"],
            "is_editable": bool(seed["is_editable"]),
            "created_at": now,
            "updated_at": now,
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


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(UTC)
    for seed in BACKUP_SETTINGS:
        _upsert_setting(conn, seed, now=now)

    op.create_table(
        "system_backups",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("storage_path", sa.String(length=512), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=True),
        sa.Column("compressed_size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("format_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("include_media", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("app_version", sa.String(length=64), nullable=True),
        sa.Column("alembic_revision", sa.String(length=128), nullable=True),
        sa.Column("created_by_user_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("audit_log_id", sa.Uuid(as_uuid=True), nullable=True),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["users.id"],
            name="fk_system_backups_created_by_user_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["audit_log_id"],
            ["audit_logs.id"],
            name="fk_system_backups_audit_log_id",
            ondelete="SET NULL",
        ),
    )
    op.create_index("ix_system_backups_filename", "system_backups", ["filename"])
    op.create_index("ix_system_backups_status", "system_backups", ["status"])
    op.create_index(
        "ix_system_backups_created_by_user_id",
        "system_backups",
        ["created_by_user_id"],
    )
    op.create_index("ix_system_backups_is_deleted", "system_backups", ["is_deleted"])
    op.create_index("ix_system_backups_created_by", "system_backups", ["created_by"])
    op.create_index("ix_system_backups_updated_by", "system_backups", ["updated_by"])
    op.create_index("ix_system_backups_deleted_by", "system_backups", ["deleted_by"])


def downgrade() -> None:
    conn = op.get_bind()
    op.drop_index("ix_system_backups_deleted_by", table_name="system_backups")
    op.drop_index("ix_system_backups_updated_by", table_name="system_backups")
    op.drop_index("ix_system_backups_created_by", table_name="system_backups")
    op.drop_index("ix_system_backups_is_deleted", table_name="system_backups")
    op.drop_index("ix_system_backups_created_by_user_id", table_name="system_backups")
    op.drop_index("ix_system_backups_status", table_name="system_backups")
    op.drop_index("ix_system_backups_filename", table_name="system_backups")
    op.drop_table("system_backups")
    for seed in BACKUP_SETTINGS:
        conn.execute(
            sa.text("DELETE FROM settings WHERE key = :key"),
            {"key": seed["key"]},
        )