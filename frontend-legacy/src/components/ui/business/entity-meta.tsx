import * as React from 'react'
import { cn } from '@/utils/cn'

export interface EntityMetaItem {
  id: string
  label: React.ReactNode
  value: React.ReactNode
}

export interface EntityMetaProps extends React.HTMLAttributes<HTMLDListElement> {
  items: EntityMetaItem[]
}

export function EntityMeta({ items, className, ...props }: EntityMetaProps): React.ReactElement {
  return (
    <dl className={cn('grid gap-3 sm:grid-cols-2', className)} {...props}>
      {items.map((item) => (
        <div key={item.id} className="min-w-0">
          <dt className="text-caption text-muted-foreground">{item.label}</dt>
          <dd className="truncate text-body text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
