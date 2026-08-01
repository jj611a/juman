"""MediaService unit/integration tests."""

from uuid import uuid4

import pytest
from app.exceptions import NotFoundError, ValidationError
from app.modules.media.services.media import MediaService, UploadPayload


def _png_upload(name: str = "dress.png", data: bytes = b"\x89PNG\r\nfake") -> UploadPayload:
    return UploadPayload(original_filename=name, content_type="image/png", data=data)


@pytest.mark.asyncio
async def test_upload_and_download(media_service: MediaService) -> None:
    stored = await media_service.upload_file(_png_upload(), uploaded_by=uuid4())
    assert stored.extension == "png"
    assert stored.sha256_hash
    assert stored.relative_path.endswith(f"{stored.id}.png")

    meta = await media_service.get_metadata(stored.id)
    assert meta.id == stored.id

    download = await media_service.download_file(stored.id)
    assert download.stream.read() == b"\x89PNG\r\nfake"
    download.stream.close()


@pytest.mark.asyncio
async def test_upload_rejects_bad_extension(media_service: MediaService) -> None:
    with pytest.raises(ValidationError):
        await media_service.upload_file(
            UploadPayload("virus.exe", "application/octet-stream", b"x" * 10)
        )


@pytest.mark.asyncio
async def test_upload_rejects_oversize(media_service: MediaService) -> None:
    from app.modules.settings.constants import SettingKey

    await media_service.settings.update_setting(
        SettingKey.MEDIA_MAX_UPLOAD_BYTES.value,
        value=8,
    )
    with pytest.raises(ValidationError):
        await media_service.upload_file(_png_upload(data=b"0123456789"))


@pytest.mark.asyncio
async def test_upload_rejects_empty(media_service: MediaService) -> None:
    with pytest.raises(ValidationError):
        await media_service.upload_file(_png_upload(data=b""))


@pytest.mark.asyncio
async def test_duplicate_hash_still_creates_new_file(media_service: MediaService) -> None:
    data = b"same-bytes-png"
    first = await media_service.upload_file(_png_upload(data=data))
    second = await media_service.upload_file(_png_upload(name="other.png", data=data))
    assert first.id != second.id
    assert first.sha256_hash == second.sha256_hash
    found = await media_service.files.find_by_sha256(first.sha256_hash)
    assert len(found) == 2


@pytest.mark.asyncio
async def test_reference_crud(media_service: MediaService) -> None:
    stored = await media_service.upload_file(_png_upload())
    entity_id = uuid4()
    ref = await media_service.create_reference(
        stored_file_id=stored.id,
        module_name="inventory",
        entity_type="dress",
        entity_id=entity_id,
        purpose="gallery",
        display_order=1,
        is_primary=True,
    )
    listed, total = await media_service.list_references(
        module_name="inventory",
        entity_type="dress",
        entity_id=entity_id,
    )
    assert total == 1
    assert listed[0].id == ref.id

    updated = await media_service.update_reference(
        ref.id,
        purpose="primary",
        display_order=0,
        is_primary=False,
    )
    assert updated.purpose == "primary"
    assert updated.is_primary is False

    await media_service.delete_reference(ref.id)
    with pytest.raises(NotFoundError):
        await media_service.get_reference(ref.id)
    # Stored file remains
    assert await media_service.get_metadata(stored.id)


@pytest.mark.asyncio
async def test_delete_file_cascades_references(media_service: MediaService) -> None:
    stored = await media_service.upload_file(_png_upload())
    ref = await media_service.create_reference(
        stored_file_id=stored.id,
        module_name="identity",
        entity_type="user",
        entity_id=uuid4(),
        purpose="avatar",
    )
    await media_service.delete_file(stored.id)
    with pytest.raises(NotFoundError):
        await media_service.get_metadata(stored.id)
    with pytest.raises(NotFoundError):
        await media_service.get_reference(ref.id)


@pytest.mark.asyncio
async def test_replace_file(media_service: MediaService) -> None:
    stored = await media_service.upload_file(_png_upload(data=b"old-bytes"))
    replaced = await media_service.replace_file(
        stored.id,
        _png_upload(name="new.png", data=b"new-bytes-png"),
    )
    assert replaced.id == stored.id
    assert replaced.size_bytes == len(b"new-bytes-png")
    download = await media_service.download_file(stored.id)
    assert download.stream.read() == b"new-bytes-png"
    download.stream.close()


@pytest.mark.asyncio
async def test_replace_reference_file_soft_deletes_old(media_service: MediaService) -> None:
    old = await media_service.upload_file(_png_upload(data=b"old-ref-bytes"))
    ref = await media_service.create_reference(
        stored_file_id=old.id,
        module_name="inventory",
        entity_type="dress",
        entity_id=uuid4(),
        purpose="photo",
    )
    new_ref, new_file = await media_service.replace_reference_file(
        ref.id,
        _png_upload(name="next.png", data=b"next-bytes"),
    )
    assert new_ref.stored_file_id == new_file.id
    with pytest.raises(NotFoundError):
        await media_service.get_metadata(old.id)


@pytest.mark.asyncio
async def test_missing_file(media_service: MediaService) -> None:
    with pytest.raises(NotFoundError):
        await media_service.get_metadata(uuid4())


@pytest.mark.asyncio
async def test_build_relative_path_and_hash() -> None:
    digest = MediaService.compute_sha256(b"abc")
    assert len(digest) == 64
    path = MediaService.build_relative_path("jpg")
    assert path.count("/") == 2
    assert path.endswith(".jpg")
