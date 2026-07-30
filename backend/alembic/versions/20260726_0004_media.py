"""Create media tables, seed media settings and media.* permissions.

Revision ID: 20260726_0004_media
Revises: 20260726_0003_identity
Create Date: 2026-07-26 13:00:00
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "20260726_0004_media"
down_revision: str | None = "20260726_0003_identity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _serialize(value: object, value_type: str) -> str:
    if value_type == "boolean":
        return "true" if bool(value) else "false"
    if value_type == "json":
        return json.dumps(value, ensure_ascii=False)
    return str(value)


MEDIA_SETTINGS: list[dict[str, object]] = [
    {
        "key": "media_storage_provider",
        "value": "local",
        "value_type": "string",
        "category": "system",
        "description": "موفر تخزين الملفات (local / s3 / minio / azure / gcs)",
        "is_editable": True,
    },
    {
        "key": "media_storage_root",
        "value": "./storage/media",
        "value_type": "string",
        "category": "system",
        "description": "مسار الجذر للتخزين المحلي",
        "is_editable": True,
    },
    {
        "key": "media_max_upload_bytes",
        "value": 10485760,
        "value_type": "integer",
        "category": "system",
        "description": "الحد الأقصى لحجم الملف بالبايت",
        "is_editable": True,
    },
    {
        "key": "media_allowed_extensions",
        "value": "jpg,jpeg,png,webp,pdf,gif",
        "value_type": "string",
        "category": "system",
        "description": "امتدادات الملفات المسموحة (مفصولة بفاصلة)",
        "is_editable": True,
    },
    {
        "key": "media_allowed_mime_types",
        "value": "image/jpeg,image/png,image/webp,image/gif,application/pdf",
        "value_type": "string",
        "category": "system",
        "description": "أنواع MIME المسموحة (مفصولة بفاصلة)",
        "is_editable": True,
    },
]

MEDIA_PERMISSIONS: list[dict[str, str]] = [
    {
        "key": "media.upload",
        "display_name": "رفع ملفات",
        "description": "رفع ملفات إلى التخزين",
        "module": "media",
    },
    {
        "key": "media.view",
        "display_name": "عرض الملفات",
        "description": "عرض وتنزيل الملفات والمراجع",
        "module": "media",
    },
    {
        "key": "media.delete",
        "display_name": "حذف ملفات",
        "description": "حذف الملفات أو مراجعها",
        "module": "media",
    },
    {
        "key": "media.manage",
        "display_name": "إدارة الملفات",
        "description": "إدارة مراجع الملفات",
        "module": "media",
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
        "stored_files",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("original_filename", sa.String(length=500), nullable=False),
        sa.Column("stored_filename", sa.String(length=255), nullable=False),
        sa.Column("extension", sa.String(length=50), nullable=False),
        sa.Column("mime_type", sa.String(length=255), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("sha256_hash", sa.String(length=64), nullable=False),
        sa.Column("storage_provider", sa.String(length=50), nullable=False),
        sa.Column("relative_path", sa.String(length=1000), nullable=False),
        sa.Column("is_public", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("uploaded_by", sa.Uuid(as_uuid=True), nullable=True),
        *_audit_columns(),
        sa.PrimaryKeyConstraint("id", name="pk_stored_files"),
    )
    op.create_index("ix_stored_files_sha256_hash", "stored_files", ["sha256_hash"])
    op.create_index(
        "ix_stored_files_storage_provider",
        "stored_files",
        ["storage_provider"],
    )
    op.create_index("ix_stored_files_uploaded_by", "stored_files", ["uploaded_by"])
    op.create_index("ix_stored_files_is_deleted", "stored_files", ["is_deleted"])

    op.create_table(
        "file_references",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("stored_file_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("module_name", sa.String(length=100), nullable=False),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("purpose", sa.String(length=100), nullable=False),
        sa.Column("display_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_primary", sa.Boolean(), server_default="false", nullable=False),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["stored_file_id"],
            ["stored_files.id"],
            name="fk_file_references_stored_file_id",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_file_references"),
    )
    op.create_index(
        "ix_file_references_stored_file_id",
        "file_references",
        ["stored_file_id"],
    )
    op.create_index(
        "ix_file_references_module_entity",
        "file_references",
        ["module_name", "entity_type", "entity_id"],
    )
    op.create_index("ix_file_references_purpose", "file_references", ["purpose"])
    op.create_index("ix_file_references_is_deleted", "file_references", ["is_deleted"])

    now = datetime.now(UTC)
    conn = op.get_bind()
    for seed in MEDIA_SETTINGS:
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

    for perm in MEDIA_PERMISSIONS:
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
    op.drop_table("file_references")
    op.drop_table("stored_files")

    conn = op.get_bind()
    keys = [p["key"] for p in MEDIA_PERMISSIONS]
    for key in keys:
        conn.execute(
            sa.text(
                """
                DELETE FROM role_permissions
                WHERE permission_id IN (SELECT id FROM permissions WHERE key = :key)
                """
            ),
            {"key": key},
        )
        conn.execute(
            sa.text("DELETE FROM permissions WHERE key = :key"),
            {"key": key},
        )
    for seed in MEDIA_SETTINGS:
        conn.execute(
            sa.text("DELETE FROM settings WHERE key = :key"),
            {"key": seed["key"]},
        )
