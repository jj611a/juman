"""Seed reports.financial.view; add report query indexes.

Revision ID: 20260729_0028_reports
Revises: 20260728_0027_sales
Create Date: 2026-07-29 00:00:00
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "20260729_0028_reports"
down_revision: str | None = "20260728_0027_sales"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

FINANCIAL_PERM = {
    "key": "reports.financial.view",
    "display_name": "عرض التقارير المالية",
    "description": "عرض التقارير والإجماليات المالية",
    "module": "reports",
}

CASHIER_FINANCIAL_KEYS: tuple[str, ...] = ("reports.financial.view",)


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(UTC)
    perm = FINANCIAL_PERM
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
    for role_name in ("Admin", "Cashier"):
        conn.execute(
            sa.text(
                """
                INSERT INTO role_permissions (
                    id, role_id, permission_id, created_at, updated_at, is_deleted
                )
                SELECT :id, r.id, p.id, :created_at, :updated_at, false
                FROM roles r
                CROSS JOIN permissions p
                WHERE r.name = :role_name
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
                "role_name": role_name,
                "key": perm["key"],
                "created_at": now,
                "updated_at": now,
            },
        )

    op.create_index("ix_sales_sold_at", "sales", ["sold_at"])
    op.create_index("ix_rentals_expected_return_at", "rentals", ["expected_return_at"])
    op.create_index(
        "ix_rental_settlement_payments_received_at",
        "rental_settlement_payments",
        ["received_at"],
    )
    op.create_index("ix_sale_payments_received_at", "sale_payments", ["received_at"])


def downgrade() -> None:
    op.drop_index("ix_sale_payments_received_at", table_name="sale_payments")
    op.drop_index(
        "ix_rental_settlement_payments_received_at",
        table_name="rental_settlement_payments",
    )
    op.drop_index("ix_rentals_expected_return_at", table_name="rentals")
    op.drop_index("ix_sales_sold_at", table_name="sales")

    conn = op.get_bind()
    key = FINANCIAL_PERM["key"]
    conn.execute(
        sa.text(
            """
            DELETE FROM role_permissions
            WHERE permission_id IN (SELECT id FROM permissions WHERE key = :key)
            """
        ),
        {"key": key},
    )
    conn.execute(sa.text("DELETE FROM permissions WHERE key = :key"), {"key": key})
