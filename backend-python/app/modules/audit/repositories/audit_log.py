"""AuditLog repository — append-only queries (no soft-delete)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.audit.models.audit_log import AuditLog


class AuditLogRepository:
    """Persistence helpers for audit logs (immutable rows)."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, entity: AuditLog) -> AuditLog:
        """Persist a new audit row."""
        self.session.add(entity)
        await self.session.flush()
        await self.session.refresh(entity)
        return entity

    async def get_by_id(self, audit_id: UUID) -> AuditLog | None:
        """Return a single audit row by id."""
        result = await self.session.execute(
            select(AuditLog).where(AuditLog.id == audit_id)
        )
        return result.scalar_one_or_none()

    def _filter_query(
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
    ) -> Select[tuple[AuditLog]]:
        stmt = select(AuditLog)
        if module:
            stmt = stmt.where(AuditLog.module == module)
        if entity_type:
            stmt = stmt.where(AuditLog.entity_type == entity_type)
        if entity_id:
            stmt = stmt.where(AuditLog.entity_id == entity_id)
        if action:
            stmt = stmt.where(AuditLog.action == action)
        if user_id is not None:
            stmt = stmt.where(AuditLog.user_id == user_id)
        if username:
            stmt = stmt.where(AuditLog.username == username.lower())
        if q:
            pattern = f"%{q.lower()}%"
            stmt = stmt.where(
                or_(
                    AuditLog.entity_type.ilike(pattern),
                    AuditLog.module.ilike(pattern),
                    AuditLog.username.ilike(pattern),
                    AuditLog.entity_id.ilike(pattern),
                    AuditLog.action.ilike(pattern),
                )
            )
        if created_from is not None:
            stmt = stmt.where(AuditLog.created_at >= created_from)
        if created_to is not None:
            stmt = stmt.where(AuditLog.created_at <= created_to)
        return stmt

    async def list_filtered(
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
    ) -> list[AuditLog]:
        """List audit rows newest-first with filters."""
        stmt = (
            self._filter_query(
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
            .order_by(AuditLog.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_filtered(
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
    ) -> int:
        """Count audit rows matching filters."""
        base = self._filter_query(
            module=module,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            user_id=user_id,
            username=username,
            q=q,
            created_from=created_from,
            created_to=created_to,
        ).subquery()
        stmt = select(func.count()).select_from(base)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())
