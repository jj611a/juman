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
    <fieldset
      className={cn(
        'fieldset rounded-box border border-base-content/10 bg-base-300 p-5 shadow-sm',
        className
      )}
      {...props}
    >
      <legend className="fieldset-legend px-1 text-h3 text-base-content">{title}</legend>
      {description ? (
        <p className="mb-4 text-body text-base-content/60">{description}</p>
      ) : null}
      <div className="flex flex-col gap-4">{children}</div>
    </fieldset>
  )
}
