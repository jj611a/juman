import * as React from 'react'
import { NumberInput, type NumberInputProps } from '@/components/ui/number-input'
import {
  IQD,
  displayToFils,
  filsToDisplay,
  type CurrencyMeta
} from '@/lib/money/currency'
import { sanitizeNumericInput } from '@/utils/normalizeDigits'
import { cn } from '@/utils/cn'

export interface MoneyInputProps
  extends Omit<NumberInputProps, 'value' | 'defaultValue' | 'onChange'> {
  /** Integer fils (minor units). */
  value?: number | null
  defaultValue?: number | null
  onChange?: (fils: number | null) => void
  onBlur?: React.FocusEventHandler<HTMLInputElement>
  currency?: CurrencyMeta
  allowNegative?: boolean
  /** Accepted for form layouts; not rendered by this control (label lives outside). */
  label?: React.ReactNode
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    {
      value,
      defaultValue,
      onChange,
      onBlur,
      currency = IQD,
      allowNegative = false,
      className,
      label: _label,
      ...props
    },
    ref
  ) => {
    void _label

    const isControlled = value !== undefined
    const [text, setText] = React.useState(() =>
      filsToDisplay(isControlled ? value : defaultValue ?? null, currency)
    )

    React.useEffect(() => {
      if (isControlled) {
        setText(filsToDisplay(value, currency))
      }
    }, [isControlled, value, currency])

    const commit = (raw: string): void => {
      const sanitized = sanitizeNumericInput(raw)
      if (!allowNegative && sanitized.startsWith('-')) {
        onChange?.(null)
        setText('')
        return
      }
      try {
        const fils = displayToFils(sanitized, currency)
        onChange?.(fils)
        if (fils !== null) {
          setText(filsToDisplay(fils, currency))
        } else {
          setText(sanitized)
        }
      } catch {
        onChange?.(null)
      }
    }

    return (
      <NumberInput
        ref={ref}
        className={cn(className)}
        value={text}
        onChange={(e) => {
          const next = sanitizeNumericInput(e.target.value)
          if (!allowNegative && next.startsWith('-')) return
          setText(next)
          try {
            onChange?.(displayToFils(next, currency))
          } catch {
            onChange?.(null)
          }
        }}
        onBlur={(e) => {
          commit(e.target.value)
          onBlur?.(e)
        }}
        inputMode="decimal"
        {...props}
      />
    )
  }
)
MoneyInput.displayName = 'MoneyInput'
