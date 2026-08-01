"""Media repositories."""

from app.modules.media.repositories.file_reference import FileReferenceRepository
from app.modules.media.repositories.stored_file import StoredFileRepository

__all__ = ["FileReferenceRepository", "StoredFileRepository"]
