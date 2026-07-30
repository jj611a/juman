import * as React from 'react'
import { cn } from '@/utils/cn'

export interface BarcodeDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  label?: string
}

/** Presentation-only barcode surface. No hardware. */
export function BarcodeDisplay({
  value,
  label,
  className,
  ...props
}: BarcodeDisplayProps): React.ReactElement {
  return (
    <div
      className={cn(
        'inline-flex flex-col items-center gap-1 rounded-md border border-border bg-secondary px-4 py-3',
        className
      )}
      {...props}
    >
      {label ? <span className="text-caption text-muted-foreground">{label}</span> : null}
      <span
        dir="ltr"
        className="font-mono text-lg tracking-[0.35em] text-foreground"
        aria-label={value}
      >
        {value}
      </span>
      <svg
        role="img"
        aria-hidden
        width="160"
        height="36"
        viewBox="0 0 160 36"
        className="text-foreground"
      >
        {value.split('').map((_, i) => {
          const x = 4 + i * 6
          const w = i % 3 === 0 ? 2 : 1
          return <rect key={i} x={x} y={2} width={w} height={32} fill="currentColor" />
        })}
      </svg>
    </div>
  )
}
