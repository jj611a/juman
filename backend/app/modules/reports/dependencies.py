"""Reports FastAPI dependencies."""

from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db
from app.modules.reports.services.report import ReportService
from app.modules.settings.services.setting import SettingService


async def get_report_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AsyncGenerator[ReportService]:
    yield ReportService(session, settings=SettingService(session))
