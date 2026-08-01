"""Media HTTP endpoints — generic files and references only."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from fastapi.responses import StreamingResponse

from app.modules.media.constants import MediaPermission
from app.modules.media.dependencies import get_media_service
from app.modules.media.schemas import (
    FileReferenceCreateRequest,
    FileReferenceItemResponse,
    FileReferenceListResponse,
    FileReferenceResponse,
    FileReferenceUpdateRequest,
    MessageOnlyResponse,
    StoredFileItemResponse,
    StoredFileResponse,
)
from app.modules.media.services.media import MediaService, UploadPayload
from app.modules.rbac.dependencies import require_any_permission
from app.schemas.common import PaginationMeta

router = APIRouter(prefix="/media", tags=["Media"])


async def _read_upload(file: UploadFile) -> UploadPayload:
    data = await file.read()
    return UploadPayload(
        original_filename=file.filename or "upload.bin",
        content_type=file.content_type,
        data=data,
    )


@router.post(
    "/files",
    response_model=StoredFileItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a file",
    dependencies=[
        Depends(
            require_any_permission(
                MediaPermission.UPLOAD.value,
                MediaPermission.MANAGE.value,
            )
        ),
    ],
)
async def upload_file(
    service: Annotated[MediaService, Depends(get_media_service)],
    file: Annotated[UploadFile, File(...)],
    is_public: Annotated[bool, Form()] = False,
) -> StoredFileItemResponse:
    """Upload a binary file and return metadata."""
    payload = await _read_upload(file)
    entity = await service.upload_file(payload, is_public=is_public)
    return StoredFileItemResponse(data=StoredFileResponse.from_model(entity))


@router.get(
    "/files/{file_id}",
    response_model=StoredFileItemResponse,
    summary="Get file metadata",
    dependencies=[
        Depends(
            require_any_permission(
                MediaPermission.VIEW.value,
                MediaPermission.MANAGE.value,
            )
        ),
    ],
)
async def get_file_metadata(
    file_id: UUID,
    service: Annotated[MediaService, Depends(get_media_service)],
) -> StoredFileItemResponse:
    """Return stored-file metadata."""
    entity = await service.get_metadata(file_id)
    return StoredFileItemResponse(data=StoredFileResponse.from_model(entity))


@router.get(
    "/files/{file_id}/download",
    summary="Download a file",
    dependencies=[
        Depends(
            require_any_permission(
                MediaPermission.VIEW.value,
                MediaPermission.MANAGE.value,
            )
        ),
    ],
)
async def download_file(
    file_id: UUID,
    service: Annotated[MediaService, Depends(get_media_service)],
) -> StreamingResponse:
    """Stream file bytes."""
    result = await service.download_file(file_id)
    headers = {
        "Content-Disposition": (f'attachment; filename="{result.file.original_filename}"'),
    }
    return StreamingResponse(
        result.stream,
        media_type=result.file.mime_type,
        headers=headers,
    )


@router.put(
    "/files/{file_id}",
    response_model=StoredFileItemResponse,
    summary="Replace file bytes",
    dependencies=[
        Depends(
            require_any_permission(
                MediaPermission.UPLOAD.value,
                MediaPermission.MANAGE.value,
            )
        ),
    ],
)
async def replace_file(
    file_id: UUID,
    service: Annotated[MediaService, Depends(get_media_service)],
    file: Annotated[UploadFile, File(...)],
) -> StoredFileItemResponse:
    """Replace the binary content of an existing stored file."""
    payload = await _read_upload(file)
    entity = await service.replace_file(file_id, payload)
    return StoredFileItemResponse(data=StoredFileResponse.from_model(entity))


@router.delete(
    "/files/{file_id}",
    response_model=MessageOnlyResponse,
    summary="Delete a file",
    dependencies=[
        Depends(
            require_any_permission(
                MediaPermission.DELETE.value,
                MediaPermission.MANAGE.value,
            )
        ),
    ],
)
async def delete_file(
    file_id: UUID,
    service: Annotated[MediaService, Depends(get_media_service)],
) -> MessageOnlyResponse:
    """Soft-delete a file, its references, and the storage blob."""
    await service.delete_file(file_id)
    return MessageOnlyResponse(message="تم حذف الملف")


@router.post(
    "/references",
    response_model=FileReferenceItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a file reference",
    dependencies=[Depends(require_any_permission(MediaPermission.MANAGE.value))],
)
async def create_reference(
    body: FileReferenceCreateRequest,
    service: Annotated[MediaService, Depends(get_media_service)],
) -> FileReferenceItemResponse:
    """Link opaque module/entity metadata to a stored file."""
    entity = await service.create_reference(
        stored_file_id=body.stored_file_id,
        module_name=body.module_name,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        purpose=body.purpose,
        display_order=body.display_order,
        is_primary=body.is_primary,
    )
    return FileReferenceItemResponse(data=FileReferenceResponse.from_model(entity))


@router.get(
    "/references",
    response_model=FileReferenceListResponse,
    summary="List file references",
    dependencies=[
        Depends(
            require_any_permission(
                MediaPermission.VIEW.value,
                MediaPermission.MANAGE.value,
            )
        ),
    ],
)
async def list_references(
    service: Annotated[MediaService, Depends(get_media_service)],
    module_name: Annotated[str | None, Query()] = None,
    entity_type: Annotated[str | None, Query()] = None,
    entity_id: Annotated[UUID | None, Query()] = None,
    purpose: Annotated[str | None, Query()] = None,
    stored_file_id: Annotated[UUID | None, Query()] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> FileReferenceListResponse:
    """List references filtered by opaque caller fields."""
    items, total = await service.list_references(
        module_name=module_name,
        entity_type=entity_type,
        entity_id=entity_id,
        purpose=purpose,
        stored_file_id=stored_file_id,
        offset=offset,
        limit=limit,
    )
    return FileReferenceListResponse(
        data=[FileReferenceResponse.from_model(item) for item in items],
        meta=PaginationMeta(offset=offset, limit=limit, total=total),
    )


@router.get(
    "/references/{reference_id}",
    response_model=FileReferenceItemResponse,
    summary="Get a file reference",
    dependencies=[
        Depends(
            require_any_permission(
                MediaPermission.VIEW.value,
                MediaPermission.MANAGE.value,
            )
        ),
    ],
)
async def get_reference(
    reference_id: UUID,
    service: Annotated[MediaService, Depends(get_media_service)],
) -> FileReferenceItemResponse:
    """Return a single file reference."""
    entity = await service.get_reference(reference_id)
    return FileReferenceItemResponse(data=FileReferenceResponse.from_model(entity))


@router.patch(
    "/references/{reference_id}",
    response_model=FileReferenceItemResponse,
    summary="Update a file reference",
    dependencies=[Depends(require_any_permission(MediaPermission.MANAGE.value))],
)
async def update_reference(
    reference_id: UUID,
    body: FileReferenceUpdateRequest,
    service: Annotated[MediaService, Depends(get_media_service)],
) -> FileReferenceItemResponse:
    """Patch purpose / display_order / is_primary."""
    entity = await service.update_reference(
        reference_id,
        purpose=body.purpose,
        display_order=body.display_order,
        is_primary=body.is_primary,
    )
    return FileReferenceItemResponse(data=FileReferenceResponse.from_model(entity))


@router.delete(
    "/references/{reference_id}",
    response_model=MessageOnlyResponse,
    summary="Delete a file reference",
    dependencies=[
        Depends(
            require_any_permission(
                MediaPermission.DELETE.value,
                MediaPermission.MANAGE.value,
            )
        ),
    ],
)
async def delete_reference(
    reference_id: UUID,
    service: Annotated[MediaService, Depends(get_media_service)],
) -> MessageOnlyResponse:
    """Soft-delete a reference without deleting the stored file."""
    await service.delete_reference(reference_id)
    return MessageOnlyResponse(message="تم حذف مرجع الملف")
