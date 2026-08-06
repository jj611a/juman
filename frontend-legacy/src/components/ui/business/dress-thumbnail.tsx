import * as React from 'react'
import { StatusChip, type StatusChipProps } from '@/components/ui/business/status-chip'
import { cn } from '@/utils/cn'

export interface DressThumbnailProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  status?: StatusChipProps
  size?: 'sm' | 'md' | 'lg'
}

const sizeClass = {
  sm: 'size-16',
  md: 'size-24',
  lg: 'size-32'
} as const

export function DressThumbnail({
  src,
  alt = '',
  status,
  size = 'md',
  className,
  ...props
}: DressThumbnailProps): React.ReactElement {
  return (
    <div
      className={cn('relative overflow-hidden rounded-md border border-border bg-muted', sizeClass[size], className)}
      {...props}
    >
      {src ? (
        <img src={src} alt={alt} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-caption text-muted-foreground">فستان</div>
      )}
      {status ? (
        <div className="absolute inset-x-1 bottom-1">
          <StatusChip {...status} className="max-w-full truncate text-[10px]" />
        </div>
      ) : null}
    </div>
  )
}
