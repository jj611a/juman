import * as React from 'react'
import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
  type BreadcrumbCrumb
} from '@/components/ui/breadcrumb'
import { cn } from '@/utils/cn'

export interface BreadcrumbHostProps extends React.HTMLAttributes<HTMLElement> {
  items?: BreadcrumbCrumb[]
}

/** Informational trail host — Sidebar remains primary nav. */
export function BreadcrumbHost({
  items = [],
  className,
  ...props
}: BreadcrumbHostProps): React.ReactElement {
  if (items.length === 0) {
    return <nav aria-label="مسار التنقل" className={cn('min-h-6', className)} {...props} />
  }
  return (
    <Breadcrumb className={className} {...props}>
      <BreadcrumbList>
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            {index > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem>
              <BreadcrumbCurrent>{item.label}</BreadcrumbCurrent>
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
