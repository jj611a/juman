"""AuditService — record and query enterprise audit logs."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.models.audit_log import AuditLog
from app.modules.audit.repositories.audit_log import AuditLogRepository
from app.services.base import BaseService
from app.utils.datetime import utc_now


def _normalize_entity_id(entity_id: UUID | str | None) -> str | None:
    if entity_id is None:
        return None
    return str(entity_id)


class AuditService(BaseService):
    """
    Application audit infrastructure for all future modules.

    Call ``record`` / ``record_*`` from domain services after successful mutations.
    Do not expose write APIs over HTTP — admin routes are read-only.
    """

    def __init__(
        self,
        session: AsyncSession,
        *,
        repository: AuditLogRepository | None = None,
    ) -> None:
        super().__init__(session)
        self.logs = repository or AuditLogRepository(session)

    async def record(
        self,
        *,
        module: str,
        entity_type: str,
        action: AuditAction | str,
        entity_id: UUID | str | None = None,
        old_values: dict[str, Any] | list[Any] | None = None,
        new_values: dict[str, Any] | list[Any] | None = None,
        user_id: UUID | None = None,
        username: str | None = None,
        ip_address: str | None = None,
        metadata: dict[str, Any] | list[Any] | None = None,
        message: str | None = None,
    ) -> AuditLog:
        """Insert a single append-only audit row."""
        module_key = module.strip().lower()
        entity = entity_type.strip()
        if not module_key:
            raise ValidationError("module is required")
        if not entity:
            raise ValidationError("entity_type is required")

        row = AuditLog(
            module=module_key,
            entity_type=entity,
            entity_id=_normalize_entity_id(entity_id),
            action=str(action).strip().lower(),
            old_values=old_values,
            new_values=new_values,
            user_id=user_id,
            username=username.lower() if username else None,
            ip_address=ip_address,
            metadata_json=metadata,
            message=message,
            created_at=utc_now(),
        )
        return await self.logs.add(row)

    async def record_create(
        self,
        *,
        module: str,
        entity_type: str,
        entity_id: UUID | str,
        new_values: dict[str, Any] | None = None,
        user_id: UUID | None = None,
        username: str | None = None,
        ip_address: str | None = None,
        metadata: dict[str, Any] | None = None,
        message: str | None = None,
    ) -> AuditLog:
        """Convenience wrapper for create actions."""
        return await self.record(
            module=module,
            entity_type=entity_type,
            entity_id=entity_id,
            action=AuditAction.CREATE,
            new_values=new_values,
            user_id=user_id,
            username=username,
            ip_address=ip_address,
            metadata=metadata,
            message=message,
        )

    async def record_update(
        self,
        *,
        module: str,
        entity_type: str,
        entity_id: UUID | str,
        old_values: dict[str, Any] | None = None,
        new_values: dict[str, Any] | None = None,
        user_id: UUID | None = None,
        username: str | None = None,
        ip_address: str | None = None,
        metadata: dict[str, Any] | None = None,
        message: str | None = None,
    ) -> AuditLog:
        """Convenience wrapper for update actions."""
        return await self.record(
            module=module,
            entity_type=entity_type,
            entity_id=entity_id,
            action=AuditAction.UPDATE,
            old_values=old_values,
            new_values=new_values,
            user_id=user_id,
            username=username,
            ip_address=ip_address,
            metadata=metadata,
            message=message,
        )

    async def record_delete(
        self,
        *,
        module: str,
        entity_type: str,
        entity_id: UUID | str,
        old_values: dict[str, Any] | None = None,
        user_id: UUID | None = None,
        username: str | None = None,
        ip_address: str | None = None,
        metadata: dict[str, Any] | None = None,
        message: str | None = None,
        soft: bool = True,
    ) -> AuditLog:
        """Convenience wrapper for delete / soft-delete actions."""
        return await self.record(
            module=module,
            entity_type=entity_type,
            entity_id=entity_id,
            action=AuditAction.SOFT_DELETE if soft else AuditAction.DELETE,
            old_values=old_values,
            user_id=user_id,
            username=username,
            ip_address=ip_address,
            metadata=metadata,
            message=message,
        )

    async def get_log(self, audit_id: UUID) -> AuditLog:
        """Return one audit row or raise NotFoundError."""
        row = await self.logs.get_by_id(audit_id)
        if row is None:
            raise NotFoundError("سجل التدقيق غير موجود")
        return row

    async def list_logs(
        self,
        *,
        module: str | None = None,
        entity_type: str | None = None,
        entity_id: str | None = None,
        action: str | None = None,
        user_id: UUID | None = None,
        username: str | None = None,
        q: str | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[AuditLog], int]:
        """List audit logs with filters and total count."""
        items = await self.logs.list_filtered(
            module=module,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            user_id=user_id,
            username=username,
            q=q,
            created_from=created_from,
            created_to=created_to,
            offset=offset,
            limit=limit,
        )
        total = await self.logs.count_filtered(
            module=module,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            user_id=user_id,
            username=username,
            q=q,
            created_from=created_from,
            created_to=created_to,
        )
        return items, total
