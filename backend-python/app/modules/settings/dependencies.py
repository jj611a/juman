"""FastAPI dependencies for the Settings module."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db
from app.modules.settings.services.setting import SettingService


async def get_setting_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SettingService:
    """Provide a request-scoped ``SettingService``."""
    return SettingService(session)
