import * as React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/utils/cn'

export interface UserChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string
  meta?: React.ReactNode
  src?: string
}

export function UserChip({ name, meta, src, className, ...props }: UserChipProps): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-secondary px-2 py-1',
        className
      )}
      {...props}
    >
      <Avatar className="size-6">
        {src ? <AvatarImage src={src} alt={name} /> : null}
        <AvatarFallback className="text-[10px]">{name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block truncate text-caption font-medium text-foreground">{name}</span>
        {meta ? (
          <span className="block truncate text-[11px] text-muted-foreground">{meta}</span>
        ) : null}
      </span>
    </span>
  )
}
