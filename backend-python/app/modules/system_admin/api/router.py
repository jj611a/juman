"""System Administration HTTP routes."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import StreamingResponse

from app.modules.identity.schemas.session import AuthenticatedPrincipal
from app.modules.rbac.dependencies import require_permission
from app.modules.system_admin.constants import (
    BackupSortField,
    MaintenanceRunSortField,
    RestoreSortField,
    SystemPermission,
)
from app.modules.system_admin.dependencies import (
    get_backup_service,
    get_diagnostics_service,
    get_maintenance_service,
    get_metrics_service,
    get_restore_service,
    get_system_info_service,
)
from app.modules.system_admin.schemas.backup import (
    BackupCreateRequest,
    BackupItemEnvelope,
    BackupListResponse,
    BackupResponse,
)
from app.modules.system_admin.schemas.restore import (
    RestoreExecuteJsonRequest,
    RestoreItemEnvelope,
    RestoreListResponse,
    RestoreResponse,
    RestoreValidateJsonRequest,
    RestoreValidationEnvelope,
    RestoreValidationResponse,
)
from app.modules.system_admin.schemas.metrics import SystemMetricsResponse
from app.modules.system_admin.schemas.system import (
    DiagnosticsResponse,
    MaintenanceExecuteRequest,
    MaintenanceHistoryListResponse,
    MaintenanceRunItemEnvelope,
    MaintenanceRunResponse,
    MaintenanceTasksResponse,
    SystemInfoResponse,
)
from app.modules.system_admin.services.backup import BackupService
from app.modules.system_admin.services.restore import RestoreService
from app.modules.system_admin.services.diagnostics import DiagnosticsService
from app.modules.system_admin.services.maintenance import MaintenanceService
from app.modules.system_admin.services.metrics import MetricsService
from app.modules.system_admin.services.system_info import SystemInfoService
from app.schemas.common import MessageResponse, PaginationMeta

router = APIRouter(prefix="/system", tags=["System Administration"])


def _client_ip(request: Request) -> str | None:
    if request.client is None:  # pragma: no cover
        return None
    return request.client.host


@router.get("/info", response_model=SystemInfoResponse, summary="System operational information")
async def system_info(
    request: Request,
    _principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(SystemPermission.VIEW.value))
    ],
    service: Annotated[SystemInfoService, Depends(get_system_info_service)],
) -> SystemInfoResponse:
    return await service.get_info(request)


@router.get("/diagnostics", response_model=DiagnosticsResponse, summary="Read-only system diagnostics")
async def system_diagnostics(
    request: Request,
    _principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(SystemPermission.VIEW.value))
    ],
    service: Annotated[DiagnosticsService, Depends(get_diagnostics_service)],
) -> DiagnosticsResponse:
    return await service.run(request)


@router.get(
    "/metrics",
    response_model=SystemMetricsResponse,
    summary="Read-only system operational metrics",
)
async def system_metrics(
    request: Request,
    _principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(SystemPermission.VIEW.value))
    ],
    service: Annotated[MetricsService, Depends(get_metrics_service)],
) -> SystemMetricsResponse:
    return await service.get_metrics(request)


@router.get(
    "/maintenance/tasks",
    response_model=MaintenanceTasksResponse,
    summary="List registered maintenance tasks",
)
async def maintenance_tasks(
    _principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(SystemPermission.VIEW.value))
    ],
    service: Annotated[MaintenanceService, Depends(get_maintenance_service)],
) -> MaintenanceTasksResponse:
    return service.list_tasks()


@router.post(
    "/maintenance/tasks/{task_key}/execute",
    response_model=MaintenanceRunItemEnvelope,
    status_code=status.HTTP_201_CREATED,
    summary="Execute a maintenance task",
)
async def execute_maintenance_task(
    task_key: str,
    body: MaintenanceExecuteRequest,
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(SystemPermission.MAINTENANCE.value))
    ],
    service: Annotated[MaintenanceService, Depends(get_maintenance_service)],
) -> MaintenanceRunItemEnvelope:
    row = await service.execute(
        task_key,
        confirm=body.confirm,
        dry_run=body.dry_run,
        actor_id=principal.user.id,
        username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return MaintenanceRunItemEnvelope(data=MaintenanceRunResponse.from_model(row))


@router.get(
    "/maintenance/history",
    response_model=MaintenanceHistoryListResponse,
    summary="List maintenance execution history",
)
async def list_maintenance_history(
    _principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(SystemPermission.MAINTENANCE.value))
    ],
    service: Annotated[MaintenanceService, Depends(get_maintenance_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    sort_by: Annotated[MaintenanceRunSortField, Query()] = MaintenanceRunSortField.STARTED_AT,
    sort_dir: Annotated[str, Query(pattern="^(?i)(asc|desc)$")] = "desc",
    task_key: Annotated[str | None, Query()] = None,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    executed_by_user_id: Annotated[UUID | None, Query()] = None,
) -> MaintenanceHistoryListResponse:
    items, total = await service.list_history(
        task_key=task_key,
        status=status_filter,
        executed_by_user_id=executed_by_user_id,
        sort_by=sort_by.value,
        sort_dir=sort_dir,
        offset=offset,
        limit=limit,
    )
    return MaintenanceHistoryListResponse(
        data=[MaintenanceRunResponse.from_model(row) for row in items],
        meta=PaginationMeta(total=total, offset=offset, limit=limit),
    )


@router.get(
    "/maintenance/history/{execution_id}",
    response_model=MaintenanceRunItemEnvelope,
    summary="Get maintenance execution detail",
)
async def get_maintenance_history(
    execution_id: UUID,
    _principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(SystemPermission.MAINTENANCE.value))
    ],
    service: Annotated[MaintenanceService, Depends(get_maintenance_service)],
) -> MaintenanceRunItemEnvelope:
    row = await service.get_history(execution_id)
    return MaintenanceRunItemEnvelope(data=MaintenanceRunResponse.from_model(row))


@router.post(
    "/backups",
    response_model=BackupItemEnvelope,
    status_code=status.HTTP_201_CREATED,
    summary="Create a local .juman backup package",
)
async def create_backup(
    request: Request,
    body: BackupCreateRequest,
    principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(SystemPermission.BACKUP.value))
    ],
    service: Annotated[BackupService, Depends(get_backup_service)],
) -> BackupItemEnvelope:
    row = await service.create(
        include_media=body.include_media,
        notes=body.notes,
        actor_id=principal.user.id,
        username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return BackupItemEnvelope(data=BackupResponse.from_model(row))


@router.get(
    "/backups",
    response_model=BackupListResponse,
    summary="List backup history",
)
async def list_backups(
    _principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(SystemPermission.BACKUP.value))
    ],
    service: Annotated[BackupService, Depends(get_backup_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    sort_by: Annotated[BackupSortField, Query()] = BackupSortField.CREATED_AT,
    sort_dir: Annotated[str, Query(pattern="^(?i)(asc|desc)$")] = "desc",
) -> BackupListResponse:
    items, total = await service.list(
        sort_by=sort_by.value,
        sort_dir=sort_dir,
        offset=offset,
        limit=limit,
    )
    return BackupListResponse(
        data=[BackupResponse.from_model(item) for item in items],
        meta=PaginationMeta(offset=offset, limit=limit, total=total),
    )


@router.get(
    "/backups/{backup_id}",
    response_model=BackupItemEnvelope,
    summary="Get backup history detail",
)
async def get_backup(
    backup_id: UUID,
    _principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(SystemPermission.BACKUP.value))
    ],
    service: Annotated[BackupService, Depends(get_backup_service)],
) -> BackupItemEnvelope:
    row = await service.get(backup_id)
    return BackupItemEnvelope(data=BackupResponse.from_model(row))


@router.get(
    "/backups/{backup_id}/download",
    summary="Download .juman backup package",
)
async def download_backup(
    request: Request,
    backup_id: UUID,
    principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(SystemPermission.BACKUP.value))
    ],
    service: Annotated[BackupService, Depends(get_backup_service)],
) -> StreamingResponse:
    row, handle = await service.open_download(
        backup_id,
        actor_id=principal.user.id,
        username=principal.user.username,
        ip_address=_client_ip(request),
    )
    headers = {
        "Content-Disposition": f'attachment; filename="{row.filename}"',
        "X-Checksum-SHA256": row.checksum_sha256 or "",
    }
    return StreamingResponse(
        service.iter_file(handle),
        media_type="application/zip",
        headers=headers,
    )


@router.delete(
    "/backups/{backup_id}",
    response_model=MessageResponse,
    summary="Soft-delete backup history and remove file",
)
async def delete_backup(
    request: Request,
    backup_id: UUID,
    principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(SystemPermission.BACKUP.value))
    ],
    service: Annotated[BackupService, Depends(get_backup_service)],
) -> MessageResponse:
    await service.soft_delete(
        backup_id,
        actor_id=principal.user.id,
        username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return MessageResponse(message="تم حذف النسخة الاحتياطية")


@router.post(
    "/restore/validate",
    response_model=RestoreValidationEnvelope,
    summary="Validate a .juman package without restoring",
)
async def validate_restore(
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(SystemPermission.RESTORE.value))
    ],
    service: Annotated[RestoreService, Depends(get_restore_service)],
) -> RestoreValidationEnvelope:
    upload_path = None
    backup_id = None
    expected_checksum = None
    content_type = (request.headers.get("content-type") or "").lower()
    if "multipart/form-data" in content_type:
        form = await request.form()
        raw_backup = form.get("backup_id")
        if raw_backup:
            backup_id = UUID(str(raw_backup))
        expected_checksum = form.get("expected_checksum")
        if expected_checksum is not None:
            expected_checksum = str(expected_checksum).strip() or None
        upload = form.get("file")
        if upload is not None and hasattr(upload, "read"):
            from app.modules.settings.constants import SettingKey
            from app.modules.settings.services.setting import SettingService
            from app.modules.system_admin.services.backup_package import resolve_storage_root

            root = resolve_storage_root(
                await SettingService(service.session).get_string(
                    SettingKey.BACKUP_STORAGE_ROOT.value
                )
            )
            data = await upload.read()  # type: ignore[union-attr]
            dest = root / "uploads"
            dest.mkdir(parents=True, exist_ok=True)
            name = Path(getattr(upload, "filename", None) or "upload.juman").name
            if not name.endswith(".juman"):
                name = f"{name}.juman"
            upload_path = dest / f"{uuid4().hex}-{name}"
            upload_path.write_bytes(data)
    else:
        body = RestoreValidateJsonRequest.model_validate(await request.json())
        backup_id = body.backup_id
        expected_checksum = body.expected_checksum

    try:
        result = await service.validate(
            backup_id=backup_id,
            upload_path=upload_path,
            expected_checksum=expected_checksum,
            actor_id=principal.user.id,
            username=principal.user.username,
            ip_address=_client_ip(request),
        )
    finally:
        if upload_path is not None and upload_path.exists():
            upload_path.unlink(missing_ok=True)

    return RestoreValidationEnvelope(data=RestoreValidationResponse.from_result(result))


@router.post(
    "/restore",
    response_model=RestoreItemEnvelope,
    status_code=status.HTTP_201_CREATED,
    summary="Restore database from a .juman package",
)
async def execute_restore(
    request: Request,
    principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(SystemPermission.RESTORE.value))
    ],
    service: Annotated[RestoreService, Depends(get_restore_service)],
) -> RestoreItemEnvelope:
    content_type = (request.headers.get("content-type") or "").lower()
    upload_path = None
    backup_id = None
    confirm = False
    confirm_checksum = ""
    notes = None

    if "multipart/form-data" in content_type:
        form = await request.form()
        raw_backup = form.get("backup_id")
        if raw_backup:
            backup_id = UUID(str(raw_backup))
        confirm = str(form.get("confirm", "")).lower() in {"true", "1", "yes"}
        confirm_checksum = str(form.get("confirm_checksum") or "").strip().lower()
        notes_val = form.get("notes")
        notes = str(notes_val).strip() if notes_val else None
        upload = form.get("file")
        if upload is not None and hasattr(upload, "read"):
            from app.modules.settings.constants import SettingKey
            from app.modules.settings.services.setting import SettingService
            from app.modules.system_admin.services.backup_package import resolve_storage_root

            root = resolve_storage_root(
                await SettingService(service.session).get_string(SettingKey.BACKUP_STORAGE_ROOT.value)
            )
            data = await upload.read()  # type: ignore[union-attr]
            dest = root / "uploads"
            dest.mkdir(parents=True, exist_ok=True)
            name = Path(getattr(upload, "filename", None) or "upload.juman").name
            if not name.endswith(".juman"):
                name = f"{name}.juman"
            upload_path = dest / f"{uuid4().hex}-{name}"
            upload_path.write_bytes(data)
    else:
        body = RestoreExecuteJsonRequest.model_validate(await request.json())
        backup_id = body.backup_id
        confirm = body.confirm
        confirm_checksum = body.confirm_checksum
        notes = body.notes

    row = await service.restore(
        backup_id=backup_id,
        upload_path=upload_path,
        confirm=confirm,
        confirm_checksum=confirm_checksum,
        notes=notes,
        actor_id=principal.user.id,
        username=principal.user.username,
        ip_address=_client_ip(request),
    )
    return RestoreItemEnvelope(data=RestoreResponse.from_model(row))


@router.get(
    "/restore/history",
    response_model=RestoreListResponse,
    summary="List restore history",
)
async def list_restore_history(
    _principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(SystemPermission.RESTORE.value))
    ],
    service: Annotated[RestoreService, Depends(get_restore_service)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    sort_by: Annotated[RestoreSortField, Query()] = RestoreSortField.STARTED_AT,
    sort_dir: Annotated[str, Query(pattern="^(?i)(asc|desc)$")] = "desc",
) -> RestoreListResponse:
    items, total = await service.list(
        sort_by=sort_by.value,
        sort_dir=sort_dir,
        offset=offset,
        limit=limit,
    )
    return RestoreListResponse(
        data=[RestoreResponse.from_model(item) for item in items],
        meta=PaginationMeta(offset=offset, limit=limit, total=total),
    )


@router.get(
    "/restore/history/{restore_id}",
    response_model=RestoreItemEnvelope,
    summary="Get restore history detail",
)
async def get_restore_history(
    restore_id: UUID,
    _principal: Annotated[
        AuthenticatedPrincipal, Depends(require_permission(SystemPermission.RESTORE.value))
    ],
    service: Annotated[RestoreService, Depends(get_restore_service)],
) -> RestoreItemEnvelope:
    row = await service.get(restore_id)
    return RestoreItemEnvelope(data=RestoreResponse.from_model(row))

