import * as React from 'react'
import {
  Button,
  CreatedUpdatedInfo,
  EntityMeta,
  PermissionGuard,
  StatusBadge
} from '@/components/ui'
import type { CategoryDto } from '@/services/domainTypes'

export interface CategoryDetailsProps {
  category: CategoryDto
  onEdit: () => void
  onActivate: () => void
  onDeactivate: () => void
  onDelete: () => void
  busy?: boolean
}

export function CategoryDetails({
  category,
  onEdit,
  onActivate,
  onDeactivate,
  onDelete,
  busy
}: CategoryDetailsProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-h3 text-foreground">{category.name_ar}</h2>
        <StatusBadge tone={category.is_active ? 'success' : 'neutral'}>
          {category.is_active ? 'نشط' : 'غير نشط'}
        </StatusBadge>
      </div>
      {category.name_en ? (
        <p className="text-body text-muted-foreground">{category.name_en}</p>
      ) : null}
      {category.description ? (
        <p className="text-body text-foreground-secondary">{category.description}</p>
      ) : null}
      <EntityMeta
        items={[
          { id: 'display_order', label: 'ترتيب العرض', value: String(category.display_order) },
          { id: 'id', label: 'المعرّف', value: category.id }
        ]}
      />
      <CreatedUpdatedInfo createdAt={category.created_at} updatedAt={category.updated_at} />
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <PermissionGuard permission="categories.update">
          <Button type="button" variant="secondary" onClick={onEdit} disabled={busy}>
            تعديل
          </Button>
        </PermissionGuard>
        <PermissionGuard permission="categories.update">
          {category.is_active ? (
            <Button type="button" variant="outline" onClick={onDeactivate} disabled={busy}>
              إلغاء التفعيل
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={onActivate} disabled={busy}>
              تفعيل
            </Button>
          )}
        </PermissionGuard>
        <PermissionGuard permission="categories.delete">
          <Button type="button" variant="danger" onClick={onDelete} disabled={busy}>
            حذف
          </Button>
        </PermissionGuard>
      </div>
    </div>
  )
}
