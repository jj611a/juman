"""FastAPI dependencies for the Categories module."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db
from app.modules.audit.services.audit_log import AuditService
from app.modules.categories.services.category import CategoryService


async def get_category_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> CategoryService:
    """Provide a request-scoped CategoryService."""
    return CategoryService(session, audit=AuditService(session))
