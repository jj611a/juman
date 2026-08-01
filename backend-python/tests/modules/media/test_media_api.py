"""Media API integration tests."""

from io import BytesIO
from uuid import uuid4

import pytest
from httpx import AsyncClient

PNG_BYTES = b"\x89PNG\r\nfake-image"


@pytest.mark.asyncio
async def test_upload_requires_auth(api_client: AsyncClient) -> None:
    response = await api_client.post(
        "/api/v1/media/files",
        files={"file": ("a.png", BytesIO(PNG_BYTES), "image/png")},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_upload_download_delete_flow(admin_client: AsyncClient) -> None:
    upload = await admin_client.post(
        "/api/v1/media/files",
        files={"file": ("dress.png", BytesIO(PNG_BYTES), "image/png")},
        data={"is_public": "false"},
    )
    assert upload.status_code == 201, upload.text
    file_id = upload.json()["data"]["id"]
    assert upload.json()["data"]["extension"] == "png"

    meta = await admin_client.get(f"/api/v1/media/files/{file_id}")
    assert meta.status_code == 200
    assert meta.json()["data"]["id"] == file_id

    download = await admin_client.get(f"/api/v1/media/files/{file_id}/download")
    assert download.status_code == 200
    assert download.content == PNG_BYTES

    replace = await admin_client.put(
        f"/api/v1/media/files/{file_id}",
        files={"file": ("dress2.png", BytesIO(b"replaced-png"), "image/png")},
    )
    assert replace.status_code == 200, replace.text
    assert replace.json()["data"]["size_bytes"] == len(b"replaced-png")

    deleted = await admin_client.delete(f"/api/v1/media/files/{file_id}")
    assert deleted.status_code == 200
    missing = await admin_client.get(f"/api/v1/media/files/{file_id}")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_reference_api_flow(admin_client: AsyncClient) -> None:
    upload = await admin_client.post(
        "/api/v1/media/files",
        files={"file": ("logo.png", BytesIO(PNG_BYTES), "image/png")},
    )
    file_id = upload.json()["data"]["id"]
    entity_id = str(uuid4())

    created = await admin_client.post(
        "/api/v1/media/references",
        json={
            "stored_file_id": file_id,
            "module_name": "settings",
            "entity_type": "company",
            "entity_id": entity_id,
            "purpose": "logo",
            "display_order": 0,
            "is_primary": True,
        },
    )
    assert created.status_code == 201, created.text
    ref_id = created.json()["data"]["id"]

    listed = await admin_client.get(
        "/api/v1/media/references",
        params={
            "module_name": "settings",
            "entity_type": "company",
            "entity_id": entity_id,
        },
    )
    assert listed.status_code == 200
    assert listed.json()["meta"]["total"] == 1

    one = await admin_client.get(f"/api/v1/media/references/{ref_id}")
    assert one.status_code == 200

    patched = await admin_client.patch(
        f"/api/v1/media/references/{ref_id}",
        json={"purpose": "brand_logo", "is_primary": False},
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["purpose"] == "brand_logo"

    deleted = await admin_client.delete(f"/api/v1/media/references/{ref_id}")
    assert deleted.status_code == 200

    # File remains after reference delete
    meta = await admin_client.get(f"/api/v1/media/files/{file_id}")
    assert meta.status_code == 200


@pytest.mark.asyncio
async def test_upload_validation_error(admin_client: AsyncClient) -> None:
    response = await admin_client.post(
        "/api/v1/media/files",
        files={"file": ("bad.exe", BytesIO(b"MZ"), "application/octet-stream")},
    )
    assert response.status_code == 422
