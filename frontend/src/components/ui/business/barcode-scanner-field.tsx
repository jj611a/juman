import * as React from 'react'
import { IconButton } from '@/components/ui/icon-button'
import { TextInput } from '@/components/ui/text-input'
import { cn } from '@/utils/cn'

export interface BarcodeScannerFieldProps
  extends Omit<React.ComponentPropsWithoutRef<typeof TextInput>, 'onChange'> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Fired when the scan affordance is activated — no hardware. */
  onScanRequest?: () => void
  scanLabel?: string
}

export function BarcodeScannerField({
  value,
  defaultValue,
  onValueChange,
  onScanRequest,
  scanLabel = 'مسح باركود',
  className,
  disabled,
  ...props
}: BarcodeScannerFieldProps): React.ReactElement {
  const [internal, setInternal] = React.useState(defaultValue ?? '')
  const current = value ?? internal

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <TextInput
        dir="ltr"
        value={current}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value
          if (value === undefined) setInternal(next)
          onValueChange?.(next)
        }}
        {...props}
      />
      <IconButton
        type="button"
        icon="ScanBarcode"
        aria-label={scanLabel}
        disabled={disabled}
        onClick={() => onScanRequest?.()}
      />
    </div>
  )
}
