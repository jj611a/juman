"""Create settings table and seed initial business settings.

Revision ID: 20260726_0001_settings
Revises:
Create Date: 2026-07-26 01:55:00
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260726_0001_settings"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _serialize(value: object, value_type: str) -> str:
    if value_type == "boolean":
        return "true" if value else "false"
    if value_type == "json":
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return str(value)


SEED_ROWS: tuple[dict[str, object], ...] = (
    {
        "key": "company_name",
        "value": "جمان",
        "value_type": "string",
        "category": "company",
        "description": "اسم الشركة",
        "is_editable": True,
    },
    {
        "key": "company_phone",
        "value": "",
        "value_type": "string",
        "category": "company",
        "description": "هاتف الشركة",
        "is_editable": True,
    },
    {
        "key": "company_address",
        "value": "",
        "value_type": "string",
        "category": "company",
        "description": "عنوان الشركة",
        "is_editable": True,
    },
    {
        "key": "company_logo",
        "value": "",
        "value_type": "string",
        "category": "company",
        "description": "مسار أو رابط شعار الشركة",
        "is_editable": True,
    },
    {
        "key": "currency",
        "value": "IQD",
        "value_type": "string",
        "category": "financial",
        "description": "العملة الافتراضية للنظام",
        "is_editable": True,
    },
    {
        "key": "maximum_initial_payment_percentage",
        "value": 50,
        "value_type": "integer",
        "category": "financial",
        "description": "الحد الأقصى لنسبة الدفعة الأولية (0-100)",
        "is_editable": True,
    },
    {
        "key": "mandatory_processing_days",
        "value": 1,
        "value_type": "integer",
        "category": "processing",
        "description": "عدد أيام المعالجة الإلزامية بعد الإرجاع",
        "is_editable": True,
    },
    {
        "key": "optional_processing_days",
        "value": 1,
        "value_type": "integer",
        "category": "processing",
        "description": "عدد أيام المعالجة الاختيارية (غسيل/كي)",
        "is_editable": True,
    },
    {
        "key": "inventory.barcode.prefix",
        "value": "DR",
        "value_type": "string",
        "category": "inventory",
        "description": "بادئة باركود الفساتين",
        "is_editable": True,
    },
    {
        "key": "inventory.barcode.separator",
        "value": "-",
        "value_type": "string",
        "category": "inventory",
        "description": "فاصل باركود الفساتين (فارغ أو - أو _)",
        "is_editable": True,
    },
    {
        "key": "inventory.barcode.padding",
        "value": 8,
        "value_type": "integer",
        "category": "inventory",
        "description": "عدد أرقام التسلسل في باركود الفستان",
        "is_editable": True,
    },
    {
        "key": "allow_manual_sale_price_override",
        "value": True,
        "value_type": "boolean",
        "category": "sales",
        "description": "السماح بتعديل سعر البيع يدوياً",
        "is_editable": True,
    },
    {
        "key": "allow_manual_rental_price_override",
        "value": True,
        "value_type": "boolean",
        "category": "rentals",
        "description": "السماح بتعديل سعر الإيجار يدوياً",
        "is_editable": True,
    },
    {
        "key": "reservation_conflict_compensation_enabled",
        "value": True,
        "value_type": "boolean",
        "category": "rentals",
        "description": "تفعيل تعويض تعارض الحجوزات",
        "is_editable": True,
    },
    {
        "key": "default_timezone",
        "value": "Asia/Baghdad",
        "value_type": "string",
        "category": "system",
        "description": "المنطقة الزمنية الافتراضية",
        "is_editable": True,
    },
)


def upgrade() -> None:
    op.create_table(
        "settings",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("value_type", sa.String(length=20), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_editable", sa.Boolean(), server_default="true", nullable=False),
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
        sa.PrimaryKeyConstraint("id", name="pk_settings"),
        sa.UniqueConstraint("key", name="uq_settings_key"),
    )
    op.create_index("ix_settings_key", "settings", ["key"], unique=False)
    op.create_index("ix_settings_category", "settings", ["category"], unique=False)
    op.create_index("ix_settings_created_by", "settings", ["created_by"], unique=False)
    op.create_index("ix_settings_updated_by", "settings", ["updated_by"], unique=False)
    op.create_index("ix_settings_is_deleted", "settings", ["is_deleted"], unique=False)
    op.create_index("ix_settings_deleted_by", "settings", ["deleted_by"], unique=False)

    # Idempotent seed: skip keys that already exist so re-runs / upgrades
    # never overwrite or duplicate existing installation data.
    now = datetime.now(UTC)
    connection = op.get_bind()
    for seed in SEED_ROWS:
        value_type = str(seed["value_type"])
        connection.execute(
            sa.text(
                """
                INSERT INTO settings (
                    id, key, value, value_type, category, description,
                    is_editable, created_at, updated_at, is_deleted
                )
                SELECT
                    :id, :key, :value, :value_type, :category, :description,
                    :is_editable, :created_at, :updated_at, false
                WHERE NOT EXISTS (
                    SELECT 1 FROM settings WHERE key = :lookup_key
                )
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
    op.drop_index("ix_settings_deleted_by", table_name="settings")
    op.drop_index("ix_settings_is_deleted", table_name="settings")
    op.drop_index("ix_settings_updated_by", table_name="settings")
    op.drop_index("ix_settings_created_by", table_name="settings")
    op.drop_index("ix_settings_category", table_name="settings")
    op.drop_index("ix_settings_key", table_name="settings")
    op.drop_table("settings")
