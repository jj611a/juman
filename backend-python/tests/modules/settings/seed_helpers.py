"""Test helpers that load Settings seed rows from the Alembic migration.

Application code must not seed settings. Tests simulate a migrated database
by applying the migration's ``SEED_ROWS`` into the test session.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from uuid import uuid4

from app.modules.settings.models.setting import Setting
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def load_settings_migration_seeds() -> tuple[dict[str, object], ...]:
    """Load ``SEED_ROWS`` from the Settings Alembic revision (single source of truth)."""
    migration_path = (
        Path(__file__).resolve().parents[3] / "alembic" / "versions" / "20260726_0001_settings.py"
    )
    spec = importlib.util.spec_from_file_location(
        "juman_settings_migration",
        migration_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load settings migration from {migration_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.SEED_ROWS


def serialize_seed_value(value: object, value_type: str) -> str:
    """Match Alembic migration serialization for seed values."""
    if value_type == "boolean":
        return "true" if value else "false"
    if value_type == "json":
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return str(value)


async def apply_migration_settings_seed(session: AsyncSession) -> int:
    """
    Insert migration seed rows into the test database when missing.

    Mirrors Alembic idempotent behaviour: existing keys are left unchanged.
    Applies both the original settings migration and identity security settings.
    """
    seeds = (
        list(load_settings_migration_seeds())
        + list(load_identity_settings_seeds())
        + list(load_media_settings_seeds())
        + list(load_session_settings_seeds())
        + list(load_password_settings_seeds())
        + list(load_customer_number_settings_seeds())
        + list(load_reservation_number_settings_seeds())
        + list(load_rental_number_settings_seeds())
        + list(load_return_number_settings_seeds())
        + list(load_inspection_number_settings_seeds())
        + list(load_processing_number_settings_seeds())
        + list(load_settlement_number_settings_seeds())
        + list(load_sale_number_settings_seeds())
        + list(load_backup_settings_seeds())
    )
    created = 0
    for seed in seeds:
        key = str(seed["key"])
        result = await session.execute(
            select(Setting.id).where(Setting.key == key, Setting.is_deleted.is_(False))
        )
        if result.scalar_one_or_none() is not None:
            continue

        value_type = str(seed["value_type"])
        description = seed["description"]
        session.add(
            Setting(
                id=uuid4(),
                key=key,
                value=serialize_seed_value(seed["value"], value_type),
                value_type=value_type,
                category=str(seed["category"]),
                description=str(description) if description is not None else None,
                is_editable=bool(seed["is_editable"]),
            )
        )
        created += 1
    await session.flush()
    return created


def load_identity_settings_seeds() -> tuple[dict[str, object], ...]:
    """Load ``IDENTITY_SETTINGS`` from the Identity Alembic revision."""
    migration_path = (
        Path(__file__).resolve().parents[3] / "alembic" / "versions" / "20260726_0003_identity.py"
    )
    spec = importlib.util.spec_from_file_location(
        "juman_identity_migration",
        migration_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load identity migration from {migration_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return tuple(module.IDENTITY_SETTINGS)


def load_media_settings_seeds() -> tuple[dict[str, object], ...]:
    """Load ``MEDIA_SETTINGS`` from the Media Alembic revision."""
    migration_path = (
        Path(__file__).resolve().parents[3] / "alembic" / "versions" / "20260726_0004_media.py"
    )
    spec = importlib.util.spec_from_file_location(
        "juman_media_migration",
        migration_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load media migration from {migration_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return tuple(module.MEDIA_SETTINGS)


def load_session_settings_seeds() -> tuple[dict[str, object], ...]:
    """Load ``SESSION_SETTINGS`` from the LoginSession Alembic revision."""
    migration_path = (
        Path(__file__).resolve().parents[3]
        / "alembic"
        / "versions"
        / "20260726_0008_login_sessions.py"
    )
    spec = importlib.util.spec_from_file_location(
        "juman_session_migration",
        migration_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load session migration from {migration_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return tuple(module.SESSION_SETTINGS)


def load_password_settings_seeds() -> tuple[dict[str, object], ...]:
    """Load ``PASSWORD_SETTINGS`` from the PasswordHistory Alembic revision."""
    migration_path = (
        Path(__file__).resolve().parents[3]
        / "alembic"
        / "versions"
        / "20260726_0010_password_history.py"
    )
    spec = importlib.util.spec_from_file_location(
        "juman_password_migration",
        migration_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load password migration from {migration_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return tuple(module.PASSWORD_SETTINGS)


def load_customer_number_settings_seeds() -> tuple[dict[str, object], ...]:
    """Load ``CUSTOMER_NUMBER_SETTINGS`` from the Customers v2 Alembic revision."""
    migration_path = (
        Path(__file__).resolve().parents[3]
        / "alembic"
        / "versions"
        / "20260726_0016_customers_v2.py"
    )
    spec = importlib.util.spec_from_file_location(
        "juman_customers_v2_migration",
        migration_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load customers v2 migration from {migration_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return tuple(module.CUSTOMER_NUMBER_SETTINGS)


def load_reservation_number_settings_seeds() -> tuple[dict[str, object], ...]:
    """Load ``RESERVATION_NUMBER_SETTINGS`` from the Reservations Alembic revision."""
    migration_path = (
        Path(__file__).resolve().parents[3]
        / "alembic"
        / "versions"
        / "20260727_0020_reservations.py"
    )
    spec = importlib.util.spec_from_file_location(
        "juman_reservations_migration",
        migration_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load reservations migration from {migration_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return tuple(module.RESERVATION_NUMBER_SETTINGS)


def load_rental_number_settings_seeds() -> tuple[dict[str, object], ...]:
    """Load ``RENTAL_NUMBER_SETTINGS`` from the Rentals Alembic revision."""
    migration_path = (
        Path(__file__).resolve().parents[3]
        / "alembic"
        / "versions"
        / "20260727_0021_rentals.py"
    )
    spec = importlib.util.spec_from_file_location(
        "juman_rentals_migration",
        migration_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load rentals migration from {migration_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return tuple(module.RENTAL_NUMBER_SETTINGS)


def load_return_number_settings_seeds() -> tuple[dict[str, object], ...]:
    """Load ``RETURN_NUMBER_SETTINGS`` from the Returns Alembic revision."""
    migration_path = (
        Path(__file__).resolve().parents[3]
        / "alembic"
        / "versions"
        / "20260728_0023_returns.py"
    )
    spec = importlib.util.spec_from_file_location(
        "juman_returns_migration",
        migration_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load returns migration from {migration_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return tuple(module.RETURN_NUMBER_SETTINGS)


def load_inspection_number_settings_seeds() -> tuple[dict[str, object], ...]:
    """Load ``INSPECTION_NUMBER_SETTINGS`` from the Inspection Alembic revision."""
    migration_path = (
        Path(__file__).resolve().parents[3]
        / "alembic"
        / "versions"
        / "20260728_0024_inspection.py"
    )
    spec = importlib.util.spec_from_file_location(
        "juman_inspection_migration",
        migration_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load inspection migration from {migration_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return tuple(module.INSPECTION_NUMBER_SETTINGS)


def load_processing_number_settings_seeds() -> tuple[dict[str, object], ...]:
    """Load ``PROCESSING_NUMBER_SETTINGS`` from the Processing Alembic revision."""
    migration_path = (
        Path(__file__).resolve().parents[3]
        / "alembic"
        / "versions"
        / "20260728_0025_processing.py"
    )
    spec = importlib.util.spec_from_file_location(
        "juman_processing_migration",
        migration_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load processing migration from {migration_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return tuple(module.PROCESSING_NUMBER_SETTINGS)


def load_settlement_number_settings_seeds() -> tuple[dict[str, object], ...]:
    """Load ``SETTLEMENT_NUMBER_SETTINGS`` from the Settlements Alembic revision."""
    migration_path = (
        Path(__file__).resolve().parents[3]
        / "alembic"
        / "versions"
        / "20260728_0026_settlements.py"
    )
    spec = importlib.util.spec_from_file_location(
        "juman_settlements_migration",
        migration_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load settlements migration from {migration_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return tuple(module.SETTLEMENT_NUMBER_SETTINGS)


def load_sale_number_settings_seeds() -> tuple[dict[str, object], ...]:
    """Load ``SALE_NUMBER_SETTINGS`` from the Sales Alembic revision."""
    migration_path = (
        Path(__file__).resolve().parents[3]
        / "alembic"
        / "versions"
        / "20260728_0027_sales.py"
    )
    spec = importlib.util.spec_from_file_location(
        "juman_sales_migration",
        migration_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load sales migration from {migration_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return tuple(module.SALE_NUMBER_SETTINGS)

def load_backup_settings_seeds() -> tuple[dict[str, object], ...]:
    """Load ``BACKUP_SETTINGS`` from the system backups Alembic revision."""
    migration_path = (
        Path(__file__).resolve().parents[3]
        / "alembic"
        / "versions"
        / "20260730_0030_system_backups.py"
    )
    spec = importlib.util.spec_from_file_location(
        "juman_backup_migration",
        migration_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load backup migration from {migration_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return tuple(module.BACKUP_SETTINGS)
