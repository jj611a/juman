"""Processing FastAPI dependencies."""

from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db
from app.modules.audit.services.audit_log import AuditService
from app.modules.calendar.services.calendar import CalendarService
from app.modules.inventory.services.dress_status import DressStatusService
from app.modules.processing.services.processing import ProcessingService
from app.modules.settings.services.setting import SettingService


async def get_processing_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AsyncGenerator[ProcessingService]:
    audit = AuditService(session)
    settings = SettingService(session)
    yield ProcessingService(
        session,
        settings=settings,
        calendar=CalendarService(session, audit=audit),
        dress_status=DressStatusService(session, audit=audit),
        audit=audit,
    )
