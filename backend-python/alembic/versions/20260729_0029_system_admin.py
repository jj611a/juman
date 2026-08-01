"""Seed system.* administration permissions (Admin only).

Revision ID: 20260729_0029_system_admin
Revises: 20260729_0028_reports
Create Date: 2026-07-29 12:00:00
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "20260729_0029_system_admin"
down_revision: str | None = "20260729_0028_reports"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SYSTEM_PERMISSIONS: tuple[dict[str, str], ...] = (
    {
        "key": "system.view",
        "display_name": "عرض إدارة النظام",
        "description": "عرض معلومات وتشخيصات النظام",
        "module": "system",
    },
    {
        "key": "system.maintenance",
        "display_name": "صيانة النظام",
        "description": "تنفيذ مهام صيانة النظام",
        "module": "system",
    },
    {
        "key": "system.backup",
        "display_name": "نسخ احتياطي للنظام",
        "description": "إنشاء نسخ احتياطية",
        "module": "system",
    },
    {
        "key": "system.restore",
        "display_name": "استعادة النظام",
        "description": "استعادة النظام من نسخة احتياطية",
        "module": "system",
    },
)


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(UTC)
    for perm in SYSTEM_PERMISSIONS:
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
                    id, role_id, permission_id, created_at, updated_at, is_deleted
                )
                SELECT :id, r.id, p.id, :created_at, :updated_at, false
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
    for perm in SYSTEM_PERMISSIONS:
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
