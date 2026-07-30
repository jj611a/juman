import * as React from 'react'
import { cn } from '@/utils/cn'

export interface SectionProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title?: React.ReactNode
  description?: React.ReactNode
}

export function Section({
  title,
  description,
  className,
  children,
  ...props
}: SectionProps): React.ReactElement {
  return (
    <section className={cn('flex flex-col gap-4', className)} {...props}>
      {title || description ? (
        <header className="flex flex-col gap-1">
          {title ? <h2 className="text-h2 text-foreground">{title}</h2> : null}
          {description ? <p className="text-body text-muted-foreground">{description}</p> : null}
        </header>
      ) : null}
      {children}
    </section>
  )
}
