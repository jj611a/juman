"""Create RBAC tables and seed roles/permissions.

Revision ID: 20260726_0002_rbac
Revises: 20260726_0001_settings
Create Date: 2026-07-26 02:40:00
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from app.modules.rbac.defaults import DEFAULT_PERMISSIONS, DEFAULT_ROLES

# revision identifiers, used by Alembic.
revision: str = "20260726_0002_rbac"
down_revision: str | None = "20260726_0001_settings"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "permissions",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("display_name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("module", sa.String(length=50), nullable=False),
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
        sa.PrimaryKeyConstraint("id", name="pk_permissions"),
        sa.UniqueConstraint("key", name="uq_permissions_key"),
    )
    op.create_index("ix_permissions_key", "permissions", ["key"], unique=False)
    op.create_index("ix_permissions_module", "permissions", ["module"], unique=False)
    op.create_index("ix_permissions_created_by", "permissions", ["created_by"], unique=False)
    op.create_index("ix_permissions_updated_by", "permissions", ["updated_by"], unique=False)
    op.create_index("ix_permissions_is_deleted", "permissions", ["is_deleted"], unique=False)
    op.create_index("ix_permissions_deleted_by", "permissions", ["deleted_by"], unique=False)

    op.create_table(
        "roles",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_system", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
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
        sa.PrimaryKeyConstraint("id", name="pk_roles"),
        sa.UniqueConstraint("name", name="uq_roles_name"),
    )
    op.create_index("ix_roles_name", "roles", ["name"], unique=False)
    op.create_index("ix_roles_is_active", "roles", ["is_active"], unique=False)
    op.create_index("ix_roles_created_by", "roles", ["created_by"], unique=False)
    op.create_index("ix_roles_updated_by", "roles", ["updated_by"], unique=False)
    op.create_index("ix_roles_is_deleted", "roles", ["is_deleted"], unique=False)
    op.create_index("ix_roles_deleted_by", "roles", ["deleted_by"], unique=False)

    op.create_table(
        "role_permissions",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("role_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("permission_id", sa.Uuid(as_uuid=True), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["permission_id"],
            ["permissions.id"],
            name="fk_role_permissions_permission_id_permissions",
        ),
        sa.ForeignKeyConstraint(
            ["role_id"],
            ["roles.id"],
            name="fk_role_permissions_role_id_roles",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_role_permissions"),
        sa.UniqueConstraint(
            "role_id",
            "permission_id",
            name="uq_role_permissions_role_permission",
        ),
    )
    op.create_index("ix_role_permissions_role_id", "role_permissions", ["role_id"], unique=False)
    op.create_index(
        "ix_role_permissions_permission_id",
        "role_permissions",
        ["permission_id"],
        unique=False,
    )
    op.create_index(
        "ix_role_permissions_created_by",
        "role_permissions",
        ["created_by"],
        unique=False,
    )
    op.create_index(
        "ix_role_permissions_updated_by",
        "role_permissions",
        ["updated_by"],
        unique=False,
    )
    op.create_index(
        "ix_role_permissions_is_deleted",
        "role_permissions",
        ["is_deleted"],
        unique=False,
    )
    op.create_index(
        "ix_role_permissions_deleted_by",
        "role_permissions",
        ["deleted_by"],
        unique=False,
    )

    now = datetime.now(UTC)
    permissions_table = sa.table(
        "permissions",
        sa.column("id", sa.Uuid(as_uuid=True)),
        sa.column("key", sa.String()),
        sa.column("display_name", sa.String()),
        sa.column("description", sa.Text()),
        sa.column("module", sa.String()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
        sa.column("is_deleted", sa.Boolean()),
    )
    roles_table = sa.table(
        "roles",
        sa.column("id", sa.Uuid(as_uuid=True)),
        sa.column("name", sa.String()),
        sa.column("description", sa.Text()),
        sa.column("is_system", sa.Boolean()),
        sa.column("is_active", sa.Boolean()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
        sa.column("is_deleted", sa.Boolean()),
    )
    role_permissions_table = sa.table(
        "role_permissions",
        sa.column("id", sa.Uuid(as_uuid=True)),
        sa.column("role_id", sa.Uuid(as_uuid=True)),
        sa.column("permission_id", sa.Uuid(as_uuid=True)),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
        sa.column("is_deleted", sa.Boolean()),
    )

    permission_ids: dict[str, object] = {}
    permission_rows = []
    for seed in DEFAULT_PERMISSIONS:
        permission_id = uuid4()
        permission_ids[seed.key] = permission_id
        permission_rows.append(
            {
                "id": permission_id,
                "key": seed.key,
                "display_name": seed.display_name,
                "description": seed.description,
                "module": seed.module,
                "created_at": now,
                "updated_at": now,
                "is_deleted": False,
            }
        )
    op.bulk_insert(permissions_table, permission_rows)

    link_rows = []
    role_rows = []
    for role_seed in DEFAULT_ROLES:
        role_id = uuid4()
        role_rows.append(
            {
                "id": role_id,
                "name": role_seed.name,
                "description": role_seed.description,
                "is_system": True,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
                "is_deleted": False,
            }
        )
        for key in role_seed.permission_keys:
            link_rows.append(
                {
                    "id": uuid4(),
                    "role_id": role_id,
                    "permission_id": permission_ids[key],
                    "created_at": now,
                    "updated_at": now,
                    "is_deleted": False,
                }
            )
    op.bulk_insert(roles_table, role_rows)
    op.bulk_insert(role_permissions_table, link_rows)


def downgrade() -> None:
    op.drop_index("ix_role_permissions_deleted_by", table_name="role_permissions")
    op.drop_index("ix_role_permissions_is_deleted", table_name="role_permissions")
    op.drop_index("ix_role_permissions_updated_by", table_name="role_permissions")
    op.drop_index("ix_role_permissions_created_by", table_name="role_permissions")
    op.drop_index("ix_role_permissions_permission_id", table_name="role_permissions")
    op.drop_index("ix_role_permissions_role_id", table_name="role_permissions")
    op.drop_table("role_permissions")

    op.drop_index("ix_roles_deleted_by", table_name="roles")
    op.drop_index("ix_roles_is_deleted", table_name="roles")
    op.drop_index("ix_roles_updated_by", table_name="roles")
    op.drop_index("ix_roles_created_by", table_name="roles")
    op.drop_index("ix_roles_is_active", table_name="roles")
    op.drop_index("ix_roles_name", table_name="roles")
    op.drop_table("roles")

    op.drop_index("ix_permissions_deleted_by", table_name="permissions")
    op.drop_index("ix_permissions_is_deleted", table_name="permissions")
    op.drop_index("ix_permissions_updated_by", table_name="permissions")
    op.drop_index("ix_permissions_created_by", table_name="permissions")
    op.drop_index("ix_permissions_module", table_name="permissions")
    op.drop_index("ix_permissions_key", table_name="permissions")
    op.drop_table("permissions")
