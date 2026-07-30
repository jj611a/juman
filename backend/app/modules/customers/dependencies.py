"""FastAPI dependencies for the Customers module."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db
from app.modules.audit.services.audit_log import AuditService
from app.modules.customers.services.customer import CustomerService
from app.modules.settings.services.setting import SettingService


async def get_customer_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> CustomerService:
    """Provide a request-scoped CustomerService."""
    return CustomerService(
        session,
        settings=SettingService(session),
        audit=AuditService(session),
    )
