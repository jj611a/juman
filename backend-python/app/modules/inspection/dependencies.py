"""FastAPI dependencies for the Inspection module."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db
from app.modules.audit.services.audit_log import AuditService
from app.modules.inspection.services.inspection import InspectionService
from app.modules.inventory.services.dress_status import DressStatusService
from app.modules.returns.services.return_service import ReturnService
from app.modules.settings.services.setting import SettingService


async def get_inspection_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> InspectionService:
    """Provide a request-scoped InspectionService."""
    audit = AuditService(session)
    settings = SettingService(session)
    dress_status = DressStatusService(session, audit=audit)
    returns = ReturnService(
        session,
        settings=settings,
        dress_status=dress_status,
        audit=audit,
    )
    return InspectionService(
        session,
        settings=settings,
        dress_status=dress_status,
        returns=returns,
        audit=audit,
    )
