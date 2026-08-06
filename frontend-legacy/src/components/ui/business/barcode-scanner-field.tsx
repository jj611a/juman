import * as React from 'react'
import { IconButton } from '@/components/ui/icon-button'
import { TextInput } from '@/components/ui/text-input'
import { cn } from '@/utils/cn'
import { apiClient } from '@/services/apiClient'

export interface BarcodeScannerFieldProps
  extends Omit<React.ComponentPropsWithoutRef<typeof TextInput>, 'onChange'> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Fired when the scan affordance is activated (manual / focus). */
  onScanRequest?: () => void
  /** Fired when a HID wedge scan completes (or Enter after fast typing). */
  onScan?: (barcode: string) => void
  scanLabel?: string
  /** Keep focus for keyboard-wedge scanners while mounted and enabled. */
  autoFocusScan?: boolean
}

export function BarcodeScannerField({
  value,
  defaultValue,
  onValueChange,
  onScanRequest,
  onScan,
  scanLabel = 'مسح باركود',
  autoFocusScan = true,
  className,
  disabled,
  ...props
}: BarcodeScannerFieldProps): React.ReactElement {
  const [internal, setInternal] = React.useState(defaultValue ?? '')
  const current = value ?? internal
  const inputRef = React.useRef<HTMLInputElement>(null)

  const setValue = React.useCallback(
    (next: string) => {
      if (value === undefined) setInternal(next)
      onValueChange?.(next)
    },
    [onValueChange, value]
  )

  React.useEffect(() => {
    if (!autoFocusScan || disabled) return
    const id = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(id)
  }, [autoFocusScan, disabled])

  React.useEffect(() => {
    if (disabled || typeof window === 'undefined' || !window.juman?.hardware?.onScan) return
    return apiClient.hardware.onScan((event) => {
      setValue(event.barcode)
      onScan?.(event.barcode)
      inputRef.current?.focus()
    })
  }, [disabled, onScan, setValue])

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <TextInput
        ref={inputRef}
        dir="ltr"
        value={current}
        disabled={disabled}
        onChange={(e) => {
          setValue(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && current.trim()) {
            onScan?.(current.trim())
          }
        }}
        {...props}
      />
      <IconButton
        type="button"
        icon="ScanBarcode"
        aria-label={scanLabel}
        disabled={disabled}
        onClick={() => {
          inputRef.current?.focus()
          onScanRequest?.()
          if (current.trim()) onScan?.(current.trim())
        }}
      />
    </div>
  )
}
