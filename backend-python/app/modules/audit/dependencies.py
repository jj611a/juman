"""FastAPI dependencies for the Audit module."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db
from app.modules.audit.services.audit_log import AuditService


async def get_audit_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AuditService:
    """Provide a request-scoped AuditService."""
    return AuditService(session)
