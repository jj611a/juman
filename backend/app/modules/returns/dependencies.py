"""FastAPI dependencies for the Returns module."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db
from app.modules.audit.services.audit_log import AuditService
from app.modules.inventory.services.dress_status import DressStatusService
from app.modules.rentals.services.rental import RentalService
from app.modules.returns.services.return_service import ReturnService
from app.modules.settings.services.setting import SettingService


async def get_return_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ReturnService:
    """Provide a request-scoped ReturnService."""
    audit = AuditService(session)
    settings = SettingService(session)
    dress_status = DressStatusService(session, audit=audit)
    rentals = RentalService(
        session,
        settings=settings,
        dress_status=dress_status,
        audit=audit,
    )
    return ReturnService(
        session,
        settings=settings,
        dress_status=dress_status,
        rentals=rentals,
        audit=audit,
    )
