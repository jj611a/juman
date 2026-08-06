import * as React from 'react'
import { RelativeTime } from '@/components/ui/business/relative-time'
import { cn } from '@/utils/cn'

export interface CreatedUpdatedInfoProps extends React.HTMLAttributes<HTMLDivElement> {
  createdAt: string | Date
  updatedAt?: string | Date
  createdBy?: React.ReactNode
  updatedBy?: React.ReactNode
}

export function CreatedUpdatedInfo({
  createdAt,
  updatedAt,
  createdBy,
  updatedBy,
  className,
  ...props
}: CreatedUpdatedInfoProps): React.ReactElement {
  return (
    <div className={cn('space-y-1 text-caption text-muted-foreground', className)} {...props}>
      <p>
        أُنشئ <RelativeTime value={createdAt} />
        {createdBy ? <> · {createdBy}</> : null}
      </p>
      {updatedAt ? (
        <p>
          حُدّث <RelativeTime value={updatedAt} />
          {updatedBy ? <> · {updatedBy}</> : null}
        </p>
      ) : null}
    </div>
  )
}
