import * as React from 'react'
import type { StoredFileMeta } from '@/components/ui/business/media-types'
import { cn } from '@/utils/cn'

export interface MediaThumbnailProps extends React.HTMLAttributes<HTMLDivElement> {
  file: StoredFileMeta
  size?: 'sm' | 'md' | 'lg'
}

const sizeClass = {
  sm: 'size-12',
  md: 'size-20',
  lg: 'size-28'
} as const

export function MediaThumbnail({
  file,
  size = 'md',
  className,
  ...props
}: MediaThumbnailProps): React.ReactElement {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-border bg-muted',
        sizeClass[size],
        className
      )}
      {...props}
    >
      {file.src ? (
        <img
          src={file.src}
          alt={file.alt ?? file.fileName ?? ''}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center text-caption text-muted-foreground">
          —
        </div>
      )}
    </div>
  )
}
