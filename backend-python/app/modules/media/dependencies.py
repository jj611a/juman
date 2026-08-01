"""FastAPI dependencies for the Media module."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db
from app.modules.media.services.media import MediaService
from app.modules.settings.dependencies import get_setting_service
from app.modules.settings.services.setting import SettingService


async def get_media_service(
    session: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[SettingService, Depends(get_setting_service)],
) -> MediaService:
    """Provide a request-scoped MediaService."""
    return MediaService(session, settings=settings)
