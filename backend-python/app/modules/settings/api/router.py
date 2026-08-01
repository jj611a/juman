"""CRUD endpoints for system settings."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.modules.rbac.dependencies import require_permission
from app.modules.settings.dependencies import get_setting_service
from app.modules.settings.enums import SettingCategory
from app.modules.settings.schemas.setting import (
    SettingListResponse,
    SettingResponse,
    SettingUpdateRequest,
    SettingValueUpdateRequest,
)
from app.modules.settings.services.setting import SettingService
from app.schemas.common import APIModel

router = APIRouter(prefix="/settings", tags=["Settings"])


class SettingItemResponse(APIModel):
    """Single-setting success envelope."""

    success: bool = True
    item: SettingResponse


@router.get(
    "",
    response_model=SettingListResponse,
    summary="List settings",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def list_settings(
    service: Annotated[SettingService, Depends(get_setting_service)],
    category: Annotated[
        SettingCategory | None,
        Query(description="Optional category filter"),
    ] = None,
) -> SettingListResponse:
    """Return all active settings, optionally filtered by category."""
    items = await service.list_settings(category=category)
    return SettingListResponse(
        total=len(items),
        items=[SettingResponse.from_model(item) for item in items],
    )


@router.get(
    "/{key}",
    response_model=SettingItemResponse,
    summary="Get setting by key",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def get_setting(
    key: str,
    service: Annotated[SettingService, Depends(get_setting_service)],
) -> SettingItemResponse:
    """Return a single setting by its unique key."""
    setting = await service.get_by_key(key)
    return SettingItemResponse(item=SettingResponse.from_model(setting))


@router.put(
    "/{key}",
    response_model=SettingItemResponse,
    summary="Update setting",
    dependencies=[Depends(require_permission("settings.update"))],
)
async def update_setting(
    key: str,
    body: SettingUpdateRequest,
    service: Annotated[SettingService, Depends(get_setting_service)],
) -> SettingItemResponse:
    """Update setting value and optional description."""
    setting = await service.update_setting(
        key,
        value=body.value,
        description=body.description,
    )
    return SettingItemResponse(item=SettingResponse.from_model(setting))


@router.patch(
    "/{key}/value",
    response_model=SettingItemResponse,
    status_code=status.HTTP_200_OK,
    summary="Update setting value",
    dependencies=[Depends(require_permission("settings.update"))],
)
async def patch_setting_value(
    key: str,
    body: SettingValueUpdateRequest,
    service: Annotated[SettingService, Depends(get_setting_service)],
) -> SettingItemResponse:
    """Update only the setting value."""
    setting = await service.update_value(key, body.value)
    return SettingItemResponse(item=SettingResponse.from_model(setting))
