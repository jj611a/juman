import * as React from 'react'
import { cn } from '@/utils/cn'

export interface FormSectionProps extends React.HTMLAttributes<HTMLElement> {
  title: string
  description?: string
}

export function FormSection({
  title,
  description,
  className,
  children,
  ...props
}: FormSectionProps): React.ReactElement {
  return (
    <section className={cn('flex flex-col gap-4', className)} {...props}>
      <header className="flex flex-col gap-1">
        <h3 className="text-h3 text-foreground">{title}</h3>
        {description ? <p className="text-body text-muted-foreground">{description}</p> : null}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}
