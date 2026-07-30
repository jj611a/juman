import * as React from 'react'
import { cn } from '@/utils/cn'

export function WizardSteps({
  steps,
  current
}: {
  steps: string[]
  current: number
}): React.ReactElement {
  return (
    <ol className="mb-6 flex flex-wrap gap-2" aria-label="خطوات المعالج">
      {steps.map((label, i) => (
        <li
          key={label}
          className={cn(
            'rounded-md border px-3 py-1.5 text-caption',
            i === current
              ? 'border-brand bg-brand-subtle text-foreground'
              : i < current
                ? 'border-border bg-secondary text-muted-foreground'
                : 'border-border text-muted-foreground'
          )}
        >
          <span className="me-1 font-medium">{i + 1}.</span>
          {label}
        </li>
      ))}
    </ol>
  )
}
