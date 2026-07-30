"""FastAPI dependencies for the Rentals module."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db
from app.modules.audit.services.audit_log import AuditService
from app.modules.calendar.services.calendar import CalendarService
from app.modules.inventory.services.dress_status import DressStatusService
from app.modules.rentals.services.rental import RentalService
from app.modules.reservations.services.reservation import ReservationService
from app.modules.settings.services.setting import SettingService


async def get_rental_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> RentalService:
    """Provide a request-scoped RentalService."""
    audit = AuditService(session)
    settings = SettingService(session)
    calendar = CalendarService(session, audit=audit)
    dress_status = DressStatusService(session, audit=audit)
    reservations = ReservationService(
        session,
        settings=settings,
        calendar=calendar,
        dress_status=dress_status,
        audit=audit,
    )
    return RentalService(
        session,
        settings=settings,
        calendar=calendar,
        dress_status=dress_status,
        reservations=reservations,
        audit=audit,
    )
