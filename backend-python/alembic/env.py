"""Async Alembic environment for Juman backend migrations."""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.config import get_settings
from app.database.base import Base

# Import abstract models so metadata is registered for future concrete models.
from app.models import AuditedSoftDeleteModel  # noqa: F401

# Module models (required for Alembic autogenerate / metadata awareness).
from app.modules.settings.models import Setting  # noqa: F401
from app.modules.rbac.models import Permission, Role, RolePermission  # noqa: F401
from app.modules.identity.models import (  # noqa: F401
    LoginHistory,
    LoginSession,
    PasswordHistory,
    RefreshToken,
    User,
)
from app.modules.media.models import FileReference, StoredFile  # noqa: F401
from app.modules.audit.models import AuditLog  # noqa: F401
from app.modules.categories.models import Category  # noqa: F401
from app.modules.customers.models import Customer  # noqa: F401
from app.modules.inventory.models import BarcodeCounter, Dress, DressPhoto  # noqa: F401
from app.modules.calendar.models import DressCalendarBlock  # noqa: F401
from app.modules.reservations.models import Reservation, ReservationItem  # noqa: F401
from app.modules.rentals.models import Rental, RentalItem  # noqa: F401
from app.modules.returns.models import Return, ReturnItem  # noqa: F401
from app.modules.inspection.models import Inspection, InspectionItem  # noqa: F401
from app.modules.processing.models import ProcessingBatch, ProcessingItem  # noqa: F401
from app.modules.settlements.models import (  # noqa: F401
    RentalSettlement,
    RentalSettlementAdjustment,
    RentalSettlementCharge,
    RentalSettlementPayment,
)
from app.modules.sales.models import Sale, SaleItem, SalePayment  # noqa: F401
from app.modules.system_admin.models import SystemBackup, SystemMaintenanceRun, SystemRestore  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    """Resolve the database URL from application settings."""
    return get_settings().database_url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Configure Alembic context and run migrations on a sync connection."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations using an async engine."""
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_url()

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
