"""Local filesystem storage provider."""

from __future__ import annotations

from pathlib import Path
from typing import BinaryIO


class LocalStorageProvider:
    """Store blobs under a configurable local root directory."""

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _resolve(self, relative_path: str) -> Path:
        cleaned = relative_path.replace("\\", "/").lstrip("/")
        if ".." in Path(cleaned).parts:
            raise ValueError("relative_path must not contain parent segments")
        target = (self.root / cleaned).resolve()
        if not str(target).startswith(str(self.root)):
            raise ValueError("relative_path escapes storage root")
        return target

    def save(self, relative_path: str, data: bytes) -> None:
        path = self._resolve(relative_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def open(self, relative_path: str) -> BinaryIO:
        path = self._resolve(relative_path)
        return path.open("rb")

    def delete(self, relative_path: str) -> None:
        path = self._resolve(relative_path)
        if path.exists() and path.is_file():
            path.unlink()

    def exists(self, relative_path: str) -> bool:
        path = self._resolve(relative_path)
        return path.is_file()
