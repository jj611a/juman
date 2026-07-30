"""FastAPI dependencies for the Inventory module."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db
from app.modules.audit.services.audit_log import AuditService
from app.modules.inventory.services.dress import DressService
from app.modules.inventory.services.dress_photo import DressPhotoService
from app.modules.inventory.services.dress_status import DressStatusService
from app.modules.settings.services.setting import SettingService


async def get_dress_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> DressService:
    """Provide a request-scoped DressService."""
    return DressService(
        session,
        settings=SettingService(session),
        audit=AuditService(session),
    )


async def get_dress_photo_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> DressPhotoService:
    """Provide a request-scoped DressPhotoService."""
    return DressPhotoService(
        session,
        settings=SettingService(session),
        audit=AuditService(session),
    )


async def get_dress_status_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> DressStatusService:
    """Provide a request-scoped DressStatusService."""
    return DressStatusService(
        session,
        audit=AuditService(session),
    )
