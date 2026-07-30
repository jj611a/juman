"""Generic async repository base following the repository pattern."""

from typing import Any
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import AuditedSoftDeleteModel
from app.utils.datetime import utc_now


class AsyncRepository[ModelT: AuditedSoftDeleteModel]:
    """
    Reusable async repository for entities inheriting ``AuditedSoftDeleteModel``.

    Provides common CRUD and soft-delete operations. Concrete module
    repositories should subclass this and add domain-specific queries.
    """

    def __init__(self, session: AsyncSession, model: type[ModelT]) -> None:
        self.session = session
        self.model = model

    def _base_query(self, *, include_deleted: bool = False) -> Select[tuple[ModelT]]:
        stmt = select(self.model)
        if not include_deleted:
            stmt = stmt.where(self.model.is_deleted.is_(False))
        return stmt

    async def get_by_id(
        self,
        entity_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> ModelT | None:
        """Fetch a single entity by UUID primary key."""
        stmt = self._base_query(include_deleted=include_deleted).where(self.model.id == entity_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 50,
        include_deleted: bool = False,
    ) -> list[ModelT]:
        """List entities with simple offset/limit pagination."""
        stmt = (
            self._base_query(include_deleted=include_deleted)
            .order_by(self.model.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count(self, *, include_deleted: bool = False) -> int:
        """Count entities matching the soft-delete filter."""
        stmt = select(func.count()).select_from(self.model)
        if not include_deleted:
            stmt = stmt.where(self.model.is_deleted.is_(False))
        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    async def add(self, entity: ModelT) -> ModelT:
        """Persist a new entity instance."""
        self.session.add(entity)
        await self.session.flush()
        await self.session.refresh(entity)
        return entity

    async def delete(
        self,
        entity: ModelT,
        *,
        deleted_by: UUID | None = None,
        hard: bool = False,
    ) -> None:
        """Soft-delete an entity by default; hard-delete when ``hard=True``."""
        if hard:
            await self.session.delete(entity)
            await self.session.flush()
            return

        entity.is_deleted = True
        entity.deleted_at = utc_now()
        entity.deleted_by = deleted_by
        await self.session.flush()

    async def restore(self, entity: ModelT) -> ModelT:
        """Clear soft-delete markers on an entity."""
        entity.is_deleted = False
        entity.deleted_at = None
        entity.deleted_by = None
        await self.session.flush()
        await self.session.refresh(entity)
        return entity

    async def update_fields(self, entity: ModelT, **fields: Any) -> ModelT:
        """Apply arbitrary field updates and flush."""
        for key, value in fields.items():
            setattr(entity, key, value)
        await self.session.flush()
        await self.session.refresh(entity)
        return entity
