import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

export interface CompanySwitcherProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string
}

/** Future-ready stub — no multi-company API yet. */
export function CompanySwitcher({
  label = 'الشركة',
  className,
  disabled = true,
  ...props
}: CompanySwitcherProps): React.ReactElement {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn('justify-start', className)}
      disabled={disabled}
      title={disabled ? 'تبديل الشركة (قريبًا)' : undefined}
      aria-label={disabled ? 'تبديل الشركة (قريبًا)' : 'تبديل الشركة'}
      {...props}
    >
      {disabled ? `${label} (قريبًا)` : label}
    </Button>
  )
}
