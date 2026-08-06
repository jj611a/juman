import * as React from 'react'
import { formatMoney, filsToDisplay, IQD, type CurrencyMeta } from '@/lib/money/currency'
import { cn } from '@/utils/cn'

export interface MoneyDisplayProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Integer fils. */
  value: number
  currency?: CurrencyMeta
  compact?: boolean
}

function formatCompact(fils: number, meta: CurrencyMeta): string {
  const raw = filsToDisplay(fils, meta)
  if (!raw) return `0 ${meta.symbol}`
  if (!raw.includes('.')) return `${raw} ${meta.symbol}`
  const [signMajor, fracPart = ''] = raw.split('.')
  const frac = fracPart.replace(/0+$/, '')
  const body = frac ? `${signMajor}.${frac}` : signMajor
  return `${body} ${meta.symbol}`
}

export function MoneyDisplay({
  value,
  currency = IQD,
  compact = false,
  className,
  ...props
}: MoneyDisplayProps): React.ReactElement {
  const truncated = Math.trunc(value)
  const signClass =
    truncated > 0
      ? 'text-success'
      : truncated < 0
        ? 'text-destructive'
        : 'text-muted-foreground'
  const text = compact ? formatCompact(truncated, currency) : formatMoney(truncated, currency)
  return (
    <span
      dir="ltr"
      className={cn('inline-flex font-medium tabular-nums', signClass, className)}
      data-sign={truncated > 0 ? 'positive' : truncated < 0 ? 'negative' : 'zero'}
      {...props}
    >
      {text}
    </span>
  )
}
