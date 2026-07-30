"""FastAPI dependencies for the Calendar module."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db
from app.modules.audit.services.audit_log import AuditService
from app.modules.calendar.services.calendar import CalendarService


async def get_calendar_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> CalendarService:
    """Provide a request-scoped CalendarService."""
    return CalendarService(session, audit=AuditService(session))
