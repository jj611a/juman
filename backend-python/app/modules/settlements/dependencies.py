"""Settlement FastAPI dependencies."""

from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db
from app.modules.audit.services.audit_log import AuditService
from app.modules.settings.services.setting import SettingService
from app.modules.settlements.services.settlement import SettlementService


async def get_settlement_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AsyncGenerator[SettlementService]:
    audit = AuditService(session)
    settings = SettingService(session)
    yield SettlementService(
        session,
        settings=settings,
        audit=audit,
    )
