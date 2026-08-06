import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { IQD, type CurrencyMeta } from '@/lib/money/currency'
import { cn } from '@/utils/cn'

export interface CurrencyBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  currency?: CurrencyMeta
}

export function CurrencyBadge({
  currency = IQD,
  className,
  ...props
}: CurrencyBadgeProps): React.ReactElement {
  return (
    <Badge variant="outline" className={cn('font-medium tracking-wide', className)} {...props}>
      {currency.code}
    </Badge>
  )
}
