"""Create rental settlement tables; seed STL settings + settlement permissions.

Revision ID: 20260728_0026_settlements
Revises: 20260728_0025_processing
Create Date: 2026-07-28 02:50:00
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "20260728_0026_settlements"
down_revision: str | None = "20260728_0025_processing"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SETTLEMENT_NUMBER_SETTINGS: tuple[dict[str, object], ...] = (
    {
        "key": "settlement.number.prefix",
        "value": "STL",
        "value_type": "string",
        "category": "financial",
        "description": "بادئة رقم التسوية",
        "is_editable": True,
    },
    {
        "key": "settlement.number.separator",
        "value": "-",
        "value_type": "string",
        "category": "financial",
        "description": "فاصل رقم التسوية (فارغ أو - أو _)",
        "is_editable": True,
    },
    {
        "key": "settlement.number.padding",
        "value": 8,
        "value_type": "integer",
        "category": "financial",
        "description": "عدد أرقام تسلسل رقم التسوية",
        "is_editable": True,
    },
)

SETTLEMENT_PERMISSIONS: tuple[dict[str, str], ...] = (
    {
        "key": "rental.settlement.view",
        "display_name": "عرض تسوية الإيجار",
        "description": "عرض تسويات الإيجار المالية",
        "module": "rental",
    },
    {
        "key": "rental.settlement.create",
        "display_name": "إنشاء تسوية إيجار",
        "description": "إنشاء تسوية مالية لإيجار مُرجع",
        "module": "rental",
    },
    {
        "key": "rental.settlement.collect",
        "display_name": "تحصيل تسوية إيجار",
        "description": "تسجيل دفعات على تسوية الإيجار",
        "module": "rental",
    },
    {
        "key": "rental.settlement.adjust",
        "display_name": "تعديل تسوية إيجار",
        "description": "إضافة تعديلات يدوية على تسوية الإيجار",
        "module": "rental",
    },
)

CASHIER_SETTLEMENT_KEYS: tuple[str, ...] = (
    "rental.settlement.view",
    "rental.settlement.create",
    "rental.settlement.collect",
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


def _immutable_audit_columns() -> list[sa.Column]:
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
    ]


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(UTC)
    for seed in SETTLEMENT_NUMBER_SETTINGS:
        _upsert_setting(conn, seed, now=now)

    prefix_row = conn.execute(
        sa.text(
            "SELECT value FROM settings WHERE key = 'settlement.number.prefix' "
            "AND is_deleted = false LIMIT 1"
        )
    ).fetchone()
    prefix = (prefix_row[0] if prefix_row else "STL").strip().upper() or "STL"
    existing_counter = conn.execute(
        sa.text("SELECT prefix FROM barcode_counters WHERE prefix = :prefix LIMIT 1"),
        {"prefix": prefix},
    ).fetchone()
    if existing_counter is None:
        conn.execute(
            sa.text(
                """
                INSERT INTO barcode_counters (prefix, last_value, updated_at)
                VALUES (:prefix, 0, :updated_at)
                """
            ),
            {"prefix": prefix, "updated_at": now},
        )

    for perm in SETTLEMENT_PERMISSIONS:
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
        # Admin
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
        if perm["key"] in CASHIER_SETTLEMENT_KEYS:
            conn.execute(
                sa.text(
                    """
                    INSERT INTO role_permissions (
                        id, role_id, permission_id, created_at, updated_at, is_deleted
                    )
                    SELECT :id, r.id, p.id, :created_at, :updated_at, false
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = 'Cashier'
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

    op.create_table(
        "rental_settlements",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("settlement_number", sa.String(length=50), nullable=False),
        sa.Column("rental_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("return_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("rental_charge_amount", sa.BigInteger(), nullable=False),
        sa.Column("initial_payment_credit", sa.BigInteger(), nullable=False),
        sa.Column("late_penalty_amount", sa.BigInteger(), nullable=False),
        sa.Column("minor_damage_penalty_amount", sa.BigInteger(), nullable=False),
        sa.Column("manual_adjustment_amount", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("gross_total", sa.BigInteger(), nullable=False),
        sa.Column("total_due", sa.BigInteger(), nullable=False),
        sa.Column("total_paid", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("remaining_balance", sa.BigInteger(), nullable=False),
        sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("settled_by", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("notes", sa.String(length=2000), nullable=True),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["rental_id"],
            ["rentals.id"],
            name="fk_rental_settlements_rental_id_rentals",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["return_id"],
            ["returns.id"],
            name="fk_rental_settlements_return_id_returns",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_rental_settlements"),
    )
    op.create_index(
        "ix_rental_settlements_settlement_number",
        "rental_settlements",
        ["settlement_number"],
    )
    op.create_index("ix_rental_settlements_rental_id", "rental_settlements", ["rental_id"])
    op.create_index("ix_rental_settlements_return_id", "rental_settlements", ["return_id"])
    op.create_index("ix_rental_settlements_status", "rental_settlements", ["status"])
    op.create_index("ix_rental_settlements_is_deleted", "rental_settlements", ["is_deleted"])
    op.create_index("ix_rental_settlements_created_at", "rental_settlements", ["created_at"])
    op.create_index(
        "uq_rental_settlements_number_alive",
        "rental_settlements",
        ["settlement_number"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
        sqlite_where=sa.text("is_deleted = 0"),
    )
    op.create_index(
        "uq_rental_settlements_rental_active",
        "rental_settlements",
        ["rental_id"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false AND status != 'VOIDED'"),
        sqlite_where=sa.text("is_deleted = 0 AND status != 'VOIDED'"),
    )

    op.create_table(
        "rental_settlement_charges",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("settlement_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("charge_type", sa.String(length=32), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("rental_item_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("inspection_item_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("description", sa.String(length=500), nullable=True),
        *_immutable_audit_columns(),
        sa.ForeignKeyConstraint(
            ["settlement_id"],
            ["rental_settlements.id"],
            name="fk_rental_settlement_charges_settlement_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["rental_item_id"],
            ["rental_items.id"],
            name="fk_rental_settlement_charges_rental_item_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["inspection_item_id"],
            ["inspection_items.id"],
            name="fk_rental_settlement_charges_inspection_item_id",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_rental_settlement_charges"),
        sa.UniqueConstraint(
            "inspection_item_id",
            name="uq_rental_settlement_charges_inspection_item",
        ),
    )
    op.create_index(
        "ix_rental_settlement_charges_settlement_id",
        "rental_settlement_charges",
        ["settlement_id"],
    )
    op.create_index(
        "ix_rental_settlement_charges_charge_type",
        "rental_settlement_charges",
        ["charge_type"],
    )
    op.create_index(
        "ix_rental_settlement_charges_rental_item_id",
        "rental_settlement_charges",
        ["rental_item_id"],
    )
    op.create_index(
        "ix_rental_settlement_charges_inspection_item_id",
        "rental_settlement_charges",
        ["inspection_item_id"],
    )

    op.create_table(
        "rental_settlement_payments",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("settlement_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("payment_method", sa.String(length=32), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_by", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("reference_number", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.String(length=1000), nullable=True),
        *_immutable_audit_columns(),
        sa.ForeignKeyConstraint(
            ["settlement_id"],
            ["rental_settlements.id"],
            name="fk_rental_settlement_payments_settlement_id",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_rental_settlement_payments"),
    )
    op.create_index(
        "ix_rental_settlement_payments_settlement_id",
        "rental_settlement_payments",
        ["settlement_id"],
    )

    op.create_table(
        "rental_settlement_adjustments",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("settlement_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("reason", sa.String(length=500), nullable=False),
        *_immutable_audit_columns(),
        sa.ForeignKeyConstraint(
            ["settlement_id"],
            ["rental_settlements.id"],
            name="fk_rental_settlement_adjustments_settlement_id",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_rental_settlement_adjustments"),
    )
    op.create_index(
        "ix_rental_settlement_adjustments_settlement_id",
        "rental_settlement_adjustments",
        ["settlement_id"],
    )


def downgrade() -> None:
    conn = op.get_bind()
    for perm in SETTLEMENT_PERMISSIONS:
        conn.execute(
            sa.text(
                """
                DELETE FROM role_permissions
                WHERE permission_id IN (SELECT id FROM permissions WHERE key = :key)
                """
            ),
            {"key": perm["key"]},
        )
        conn.execute(sa.text("DELETE FROM permissions WHERE key = :key"), {"key": perm["key"]})

    prefix_row = conn.execute(
        sa.text(
            "SELECT value FROM settings WHERE key = 'settlement.number.prefix' "
            "AND is_deleted = false LIMIT 1"
        )
    ).fetchone()
    prefix = (prefix_row[0] if prefix_row else "STL").strip().upper() or "STL"
    conn.execute(sa.text("DELETE FROM barcode_counters WHERE prefix = :prefix"), {"prefix": prefix})
    for seed in SETTLEMENT_NUMBER_SETTINGS:
        conn.execute(sa.text("DELETE FROM settings WHERE key = :key"), {"key": seed["key"]})

    op.drop_index(
        "ix_rental_settlement_adjustments_settlement_id",
        table_name="rental_settlement_adjustments",
    )
    op.drop_table("rental_settlement_adjustments")
    op.drop_index(
        "ix_rental_settlement_payments_settlement_id",
        table_name="rental_settlement_payments",
    )
    op.drop_table("rental_settlement_payments")
    op.drop_index(
        "ix_rental_settlement_charges_inspection_item_id",
        table_name="rental_settlement_charges",
    )
    op.drop_index(
        "ix_rental_settlement_charges_rental_item_id",
        table_name="rental_settlement_charges",
    )
    op.drop_index(
        "ix_rental_settlement_charges_charge_type",
        table_name="rental_settlement_charges",
    )
    op.drop_index(
        "ix_rental_settlement_charges_settlement_id",
        table_name="rental_settlement_charges",
    )
    op.drop_table("rental_settlement_charges")
    op.drop_index("uq_rental_settlements_rental_active", table_name="rental_settlements")
    op.drop_index("uq_rental_settlements_number_alive", table_name="rental_settlements")
    op.drop_index("ix_rental_settlements_created_at", table_name="rental_settlements")
    op.drop_index("ix_rental_settlements_is_deleted", table_name="rental_settlements")
    op.drop_index("ix_rental_settlements_status", table_name="rental_settlements")
    op.drop_index("ix_rental_settlements_return_id", table_name="rental_settlements")
    op.drop_index("ix_rental_settlements_rental_id", table_name="rental_settlements")
    op.drop_index("ix_rental_settlements_settlement_number", table_name="rental_settlements")
    op.drop_table("rental_settlements")
