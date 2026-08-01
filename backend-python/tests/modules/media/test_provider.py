"""LocalStorageProvider unit tests."""

from pathlib import Path

import pytest
from app.modules.media.providers.local import LocalStorageProvider


def test_local_save_open_exists_delete(tmp_path: Path) -> None:
    provider = LocalStorageProvider(tmp_path)
    relative = "2026/07/demo.png"
    payload = b"hello-media"

    assert provider.exists(relative) is False
    provider.save(relative, payload)
    assert provider.exists(relative) is True

    with provider.open(relative) as stream:
        assert stream.read() == payload

    provider.delete(relative)
    assert provider.exists(relative) is False
    provider.delete(relative)  # idempotent


def test_local_rejects_path_escape(tmp_path: Path) -> None:
    provider = LocalStorageProvider(tmp_path)
    with pytest.raises(ValueError):
        provider.save("../escape.txt", b"x")
