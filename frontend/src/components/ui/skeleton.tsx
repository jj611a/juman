import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/cn'

const skeletonVariants = cva('skeleton rounded-md bg-base-200', {
  variants: {
    variant: {
      text: 'h-4 w-full',
      card: 'h-32 w-full',
      table: 'h-10 w-full',
      avatar: 'size-10 rounded-full',
      list: 'h-12 w-full',
      image: 'aspect-video w-full'
    }
  },
  defaultVariants: { variant: 'text' }
})

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

export function Skeleton({ className, variant, ...props }: SkeletonProps): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      className={cn(skeletonVariants({ variant }), className)}
      {...props}
    />
  )
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }): React.ReactElement {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} variant="text" className={i === lines - 1 ? 'w-2/3' : undefined} />
      ))}
    </div>
  )
}

export function SkeletonCard({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={cn('card juman-surface flex flex-col gap-3 border border-base-content/10 p-5', className)}>
      <Skeleton variant="text" className="w-1/3" />
      <Skeleton variant="card" />
      <SkeletonText lines={2} />
    </div>
  )
}

export function SkeletonTable({ rows = 4, className }: { rows?: number; className?: string }): React.ReactElement {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Skeleton variant="table" className="h-9" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="table" />
      ))}
    </div>
  )
}

export function SkeletonList({ items = 4, className }: { items?: number; className?: string }): React.ReactElement {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {Array.from({ length: items }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton variant="avatar" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton variant="text" className="w-1/2" />
            <Skeleton variant="text" className="w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}
