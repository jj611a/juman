import * as React from 'react'
import { Spinner } from '@/components/ui/spinner'
import { fieldVariants, type FieldVariantProps } from '@/components/ui/input-base'
import { sanitizeNumericInput } from '@/utils/normalizeDigits'
import { cn } from '@/utils/cn'

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'>,
    FieldVariantProps {
  errorMessage?: string
  hint?: string
  loading?: boolean
  /** Accepted for form layouts; label is rendered by the parent FormField. */
  label?: React.ReactNode
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      className,
      fieldSize,
      fieldState,
      errorMessage,
      hint,
      id,
      disabled,
      readOnly,
      loading = false,
      onChange,
      value,
      defaultValue,
      label: _label,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    void _label
    const describedBy = [ariaDescribedBy, errorMessage ? `${id}-error` : null, hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(' ') || undefined
    const invalid = fieldState === 'error' || Boolean(errorMessage)
    const isDisabled = disabled || loading

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
      const normalized = sanitizeNumericInput(event.target.value)
      if (normalized !== event.target.value) {
        event.target.value = normalized
      }
      onChange?.(event)
    }

    return (
      <div className="relative flex w-full flex-col gap-1.5">
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          disabled={isDisabled}
          readOnly={readOnly}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-busy={loading || undefined}
          {...props}
          value={value === undefined ? undefined : sanitizeNumericInput(String(value))}
          defaultValue={
            defaultValue === undefined ? undefined : sanitizeNumericInput(String(defaultValue))
          }
          onChange={handleChange}
          className={cn(
            fieldVariants({ fieldSize, fieldState: invalid ? 'error' : fieldState }),
            'input-numeric',
            loading && 'pe-9',
            className
          )}
        />
        {loading ? (
          <span className="pointer-events-none absolute end-3 top-2.5 text-muted-foreground">
            <Spinner size="sm" tone="muted" />
          </span>
        ) : null}
        {hint && !errorMessage ? (
          <p id={id ? `${id}-hint` : undefined} className="text-caption text-muted-foreground">
            {hint}
          </p>
        ) : null}
        {errorMessage ? (
          <p id={id ? `${id}-error` : undefined} className="text-caption text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>
    )
  }
)
NumberInput.displayName = 'NumberInput'
