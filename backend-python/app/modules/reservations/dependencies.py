"""FastAPI dependencies for the Reservations module."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db
from app.modules.audit.services.audit_log import AuditService
from app.modules.calendar.services.calendar import CalendarService
from app.modules.inventory.services.dress_status import DressStatusService
from app.modules.reservations.services.reservation import ReservationService
from app.modules.settings.services.setting import SettingService


async def get_reservation_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ReservationService:
    """Provide a request-scoped ReservationService."""
    audit = AuditService(session)
    return ReservationService(
        session,
        settings=SettingService(session),
        calendar=CalendarService(session, audit=audit),
        dress_status=DressStatusService(session, audit=audit),
        audit=audit,
    )
