import * as React from 'react'
import { Chip } from '@/components/ui/chip'
import { cn } from '@/utils/cn'

export interface TagListItem {
  id: string
  label: React.ReactNode
}

export interface TagListProps extends React.HTMLAttributes<HTMLDivElement> {
  tags: TagListItem[]
  onDismiss?: (id: string) => void
  dismissLabel?: string
}

export function TagList({
  tags,
  onDismiss,
  dismissLabel,
  className,
  ...props
}: TagListProps): React.ReactElement {
  return (
    <div className={cn('flex flex-wrap gap-2', className)} {...props}>
      {tags.map((tag) => (
        <Chip
          key={tag.id}
          onDismiss={onDismiss ? () => onDismiss(tag.id) : undefined}
          dismissLabel={dismissLabel}
        >
          {tag.label}
        </Chip>
      ))}
    </div>
  )
}
