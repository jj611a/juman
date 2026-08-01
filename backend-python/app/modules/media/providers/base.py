"""Storage provider protocol."""

from __future__ import annotations

from typing import BinaryIO, Protocol


class StorageProvider(Protocol):
    """Binary storage backend used by MediaService."""

    def save(self, relative_path: str, data: bytes) -> None:
        """Persist bytes at ``relative_path`` under the provider root."""

    def open(self, relative_path: str) -> BinaryIO:
        """Open a readable binary stream for ``relative_path``."""

    def delete(self, relative_path: str) -> None:
        """Delete the object at ``relative_path`` if it exists."""

    def exists(self, relative_path: str) -> bool:
        """Return whether ``relative_path`` exists."""
