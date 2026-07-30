import * as React from 'react'
import { CreatedUpdatedInfo, type CreatedUpdatedInfoProps } from '@/components/ui/business/created-updated-info'
import { EntityMeta, type EntityMetaItem } from '@/components/ui/business/entity-meta'
import { cn } from '@/utils/cn'

export interface RecordInfoPanelProps extends React.HTMLAttributes<HTMLElement> {
  title?: React.ReactNode
  metaItems?: EntityMetaItem[]
  createdUpdated?: CreatedUpdatedInfoProps
}

export function RecordInfoPanel({
  title = 'معلومات السجل',
  metaItems = [],
  createdUpdated,
  className,
  children,
  ...props
}: RecordInfoPanelProps): React.ReactElement {
  return (
    <aside
      className={cn('space-y-4 rounded-md border border-border bg-surface p-4', className)}
      {...props}
    >
      <h3 className="text-body font-semibold text-foreground">{title}</h3>
      {metaItems.length > 0 ? <EntityMeta items={metaItems} /> : null}
      {createdUpdated ? <CreatedUpdatedInfo {...createdUpdated} /> : null}
      {children}
    </aside>
  )
}
