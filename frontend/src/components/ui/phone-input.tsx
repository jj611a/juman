import * as React from 'react'
import { fieldVariants, type FieldVariantProps } from '@/components/ui/input-base'
import { Spinner } from '@/components/ui/spinner'
import { PhoneService } from '@/lib/phone/phoneService'
import { cn } from '@/utils/cn'

export interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type' | 'value' | 'defaultValue' | 'onChange'>,
    FieldVariantProps {
  /** Canonical E.164 or null. */
  value?: string | null
  defaultValue?: string | null
  onChange?: (e164: string | null) => void
  errorMessage?: string
  hint?: string
  loading?: boolean
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      className,
      fieldSize,
      fieldState,
      value,
      defaultValue,
      onChange,
      onBlur,
      errorMessage,
      hint,
      id,
      disabled,
      readOnly,
      loading = false,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const isControlled = value !== undefined
    const [text, setText] = React.useState(() =>
      PhoneService.format(isControlled ? value : defaultValue ?? null)
    )

    React.useEffect(() => {
      if (isControlled) {
        setText(PhoneService.format(value))
      }
    }, [isControlled, value])

    const describedBy = [ariaDescribedBy, errorMessage ? `${id}-error` : null, hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(' ') || undefined
    const invalid = fieldState === 'error' || Boolean(errorMessage)
    const isDisabled = disabled || loading

    const commit = (raw: string): void => {
      if (!raw.trim()) {
        onChange?.(null)
        setText('')
        return
      }
      const result = PhoneService.normalize(raw)
      if (result.ok) {
        onChange?.(result.e164)
        setText(PhoneService.format(result.e164))
      } else {
        onChange?.(null)
        setText(raw)
      }
    }

    return (
      <div className="relative flex w-full flex-col gap-1.5">
        <input
          ref={ref}
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          disabled={isDisabled}
          readOnly={readOnly}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-busy={loading || undefined}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            const result = PhoneService.normalize(e.target.value)
            onChange?.(result.ok ? result.e164 : null)
          }}
          onBlur={(e) => {
            commit(e.target.value)
            onBlur?.(e)
          }}
          className={cn(
            fieldVariants({ fieldSize, fieldState: invalid ? 'error' : fieldState }),
            'input-phone',
            loading && 'pe-9',
            className
          )}
          {...props}
        />
        {loading ? (
          <span className="pointer-events-none absolute end-3 top-2.5">
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
PhoneInput.displayName = 'PhoneInput'
