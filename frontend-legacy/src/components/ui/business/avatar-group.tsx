import * as React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/utils/cn'

export interface AvatarGroupItem {
  id: string
  name: string
  src?: string
}

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  items: AvatarGroupItem[]
  max?: number
  size?: 'sm' | 'md'
}

const sizeClass = {
  sm: 'size-7 text-[10px]',
  md: 'size-9 text-caption'
} as const

export function AvatarGroup({
  items,
  max = 3,
  size = 'md',
  className,
  ...props
}: AvatarGroupProps): React.ReactElement {
  const visible = items.slice(0, max)
  const overflow = Math.max(0, items.length - max)

  return (
    <div className={cn('flex items-center', className)} role="group" {...props}>
      {visible.map((item, index) => (
        <Avatar
          key={item.id}
          className={cn(sizeClass[size], 'border-2 border-background', index > 0 && '-ms-2')}
          title={item.name}
        >
          {item.src ? <AvatarImage src={item.src} alt={item.name} /> : null}
          <AvatarFallback>{item.name.slice(0, 1)}</AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 ? (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full border-2 border-background bg-secondary font-medium text-secondary-foreground',
            sizeClass[size],
            '-ms-2'
          )}
          aria-label={`+${overflow}`}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  )
}
