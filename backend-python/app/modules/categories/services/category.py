"""CategoryService — CRUD and activation for organizational labels."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import BusinessError, ConflictError, NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.categories.constants import CategorySortField
from app.modules.categories.models.category import Category
from app.modules.categories.repositories.category import CategoryRepository
from app.services.base import BaseService
from app.utils.datetime import utc_now


def _snapshot(category: Category) -> dict[str, Any]:
    return {
        "name_ar": category.name_ar,
        "name_en": category.name_en,
        "description": category.description,
        "display_order": category.display_order,
        "is_active": category.is_active,
    }


class CategoryService(BaseService):
    """Manage dress categories (classification only)."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        repository: CategoryRepository | None = None,
        audit: AuditService | None = None,
    ) -> None:
        super().__init__(session)
        self.categories = repository or CategoryRepository(session)
        self.audit = audit or AuditService(session)

    async def _count_dress_references(self, category_id: UUID) -> int:
        """Count live dresses referencing this category."""
        from app.modules.inventory.repositories.dress import DressRepository

        return await DressRepository(self.session).count_by_category(category_id)

    async def get_category(self, category_id: UUID) -> Category:
        """Return a live category or raise NotFoundError."""
        category = await self.categories.get_by_id(category_id)
        if category is None:
            raise NotFoundError("التصنيف غير موجود")
        return category

    async def list_categories(
        self,
        *,
        active_only: bool = False,
        q: str | None = None,
        sort_by: CategorySortField | str = CategorySortField.DISPLAY_ORDER,
        sort_dir: str = "asc",
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Category], int]:
        """List categories with filters and pagination."""
        allowed = {item.value for item in CategorySortField}
        sort_key = str(sort_by)
        if sort_key not in allowed:
            raise ValidationError(
                "حقل الترتيب غير صالح",
                details={"sort_by": sort_key, "allowed": sorted(allowed)},
            )
        direction = sort_dir.lower()
        if direction not in {"asc", "desc"}:
            raise ValidationError(
                "اتجاه الترتيب غير صالح",
                details={"sort_dir": sort_dir},
            )
        items = await self.categories.list_filtered(
            active_only=active_only,
            q=q,
            sort_by=sort_key,
            sort_dir=direction,
            offset=offset,
            limit=limit,
        )
        total = await self.categories.count_filtered(active_only=active_only, q=q)
        return items, total

    async def create_category(
        self,
        *,
        name_ar: str,
        name_en: str | None = None,
        description: str | None = None,
        display_order: int = 0,
        is_active: bool = True,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Category:
        """Create a category and write an audit row."""
        normalized_ar = name_ar.strip()
        if not normalized_ar:
            raise ValidationError("الاسم العربي مطلوب")
        existing = await self.categories.get_by_name_ar(normalized_ar)
        if existing is not None:
            raise ConflictError("يوجد تصنيف بهذا الاسم العربي مسبقاً")

        category = Category(
            name_ar=normalized_ar,
            name_en=name_en.strip() if name_en and name_en.strip() else None,
            description=description.strip() if description and description.strip() else None,
            display_order=display_order,
            is_active=is_active,
            created_by=actor_id,
            updated_by=actor_id,
        )
        category = await self.categories.add(category)
        await self.audit.record_create(
            module="categories",
            entity_type="Category",
            entity_id=category.id,
            new_values=_snapshot(category),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
        )
        return category

    async def update_category(
        self,
        category_id: UUID,
        *,
        name_ar: str | None = None,
        name_en: str | None = None,
        description: str | None = None,
        display_order: int | None = None,
        is_active: bool | None = None,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Category:
        """Update mutable category fields and audit the change."""
        category = await self.get_category(category_id)
        old_values = _snapshot(category)

        fields: dict[str, object] = {
            "updated_by": actor_id,
            "updated_at": utc_now(),
        }
        if name_ar is not None:
            normalized_ar = name_ar.strip()
            if not normalized_ar:
                raise ValidationError("الاسم العربي مطلوب")
            duplicate = await self.categories.get_by_name_ar(
                normalized_ar,
                exclude_id=category.id,
            )
            if duplicate is not None:
                raise ConflictError("يوجد تصنيف بهذا الاسم العربي مسبقاً")
            fields["name_ar"] = normalized_ar
        if name_en is not None:
            fields["name_en"] = name_en.strip() or None
        if description is not None:
            fields["description"] = description.strip() or None
        if display_order is not None:
            fields["display_order"] = display_order
        if is_active is not None:
            fields["is_active"] = is_active

        category = await self.categories.update_fields(category, **fields)
        await self.audit.record_update(
            module="categories",
            entity_type="Category",
            entity_id=category.id,
            old_values=old_values,
            new_values=_snapshot(category),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
        )
        return category

    async def activate(
        self,
        category_id: UUID,
        *,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Category:
        """Set is_active=true."""
        category = await self.get_category(category_id)
        old_values = _snapshot(category)
        category = await self.categories.update_fields(
            category,
            is_active=True,
            updated_by=actor_id,
            updated_at=utc_now(),
        )
        await self.audit.record(
            module="categories",
            entity_type="Category",
            entity_id=category.id,
            action=AuditAction.ACTIVATE,
            old_values=old_values,
            new_values=_snapshot(category),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
        )
        return category

    async def deactivate(
        self,
        category_id: UUID,
        *,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Category:
        """Set is_active=false."""
        category = await self.get_category(category_id)
        old_values = _snapshot(category)
        category = await self.categories.update_fields(
            category,
            is_active=False,
            updated_by=actor_id,
            updated_at=utc_now(),
        )
        await self.audit.record(
            module="categories",
            entity_type="Category",
            entity_id=category.id,
            action=AuditAction.DEACTIVATE,
            old_values=old_values,
            new_values=_snapshot(category),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
        )
        return category

    async def soft_delete(
        self,
        category_id: UUID,
        *,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> None:
        """Soft-delete a category when not referenced by dresses."""
        category = await self.get_category(category_id)
        refs = await self._count_dress_references(category_id)
        if refs > 0:
            raise BusinessError(
                "لا يمكن حذف التصنيف لأنه مرتبط بفساتين",
                code="category_in_use",
                status_code=409,
                details={"dress_count": refs},
            )
        old_values = _snapshot(category)
        await self.categories.delete(category, deleted_by=actor_id)
        await self.audit.record_delete(
            module="categories",
            entity_type="Category",
            entity_id=category_id,
            old_values=old_values,
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            soft=True,
        )
