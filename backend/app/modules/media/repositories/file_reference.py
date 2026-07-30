"""FileReference repository."""

from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.media.models.file_reference import FileReference
from app.repositories.base import AsyncRepository


class FileReferenceRepository(AsyncRepository[FileReference]):
    """Persistence helpers for opaque file references."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, FileReference)

    def _filtered_query(
        self,
        *,
        module_name: str | None = None,
        entity_type: str | None = None,
        entity_id: UUID | None = None,
        purpose: str | None = None,
        stored_file_id: UUID | None = None,
    ) -> Select[tuple[FileReference]]:
        stmt = self._base_query()
        if module_name is not None:
            stmt = stmt.where(FileReference.module_name == module_name)
        if entity_type is not None:
            stmt = stmt.where(FileReference.entity_type == entity_type)
        if entity_id is not None:
            stmt = stmt.where(FileReference.entity_id == entity_id)
        if purpose is not None:
            stmt = stmt.where(FileReference.purpose == purpose)
        if stored_file_id is not None:
            stmt = stmt.where(FileReference.stored_file_id == stored_file_id)
        return stmt

    async def list_filtered(
        self,
        *,
        module_name: str | None = None,
        entity_type: str | None = None,
        entity_id: UUID | None = None,
        purpose: str | None = None,
        stored_file_id: UUID | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[FileReference], int]:
        """List references filtered by opaque caller metadata."""
        filters = {
            "module_name": module_name,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "purpose": purpose,
            "stored_file_id": stored_file_id,
        }
        stmt = self._filtered_query(**filters)
        total_result = await self.session.execute(
            select(func.count()).select_from(self._filtered_query(**filters).subquery())
        )
        total = int(total_result.scalar_one())
        result = await self.session.execute(
            stmt.order_by(
                FileReference.display_order.asc(),
                FileReference.created_at.desc(),
            )
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all()), total

    async def list_by_stored_file(self, stored_file_id: UUID) -> list[FileReference]:
        """Return active references pointing at a stored file."""
        stmt = self._base_query().where(FileReference.stored_file_id == stored_file_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
