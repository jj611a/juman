"""StoredFile repository."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.media.models.stored_file import StoredFile
from app.repositories.base import AsyncRepository


class StoredFileRepository(AsyncRepository[StoredFile]):
    """Persistence helpers for stored files."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, StoredFile)

    async def find_by_sha256(self, sha256_hash: str) -> list[StoredFile]:
        """Return active files matching a content hash (no auto-reuse)."""
        stmt = self._base_query().where(StoredFile.sha256_hash == sha256_hash)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_active(self, file_id: UUID) -> StoredFile | None:
        """Fetch a non-deleted stored file by id."""
        return await self.get_by_id(file_id, include_deleted=False)
