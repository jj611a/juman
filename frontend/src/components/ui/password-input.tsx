import * as React from 'react'
import { IconButton } from '@/components/ui/icon-button'
import { fieldVariants, type FieldVariantProps } from '@/components/ui/input-base'
import { cn } from '@/utils/cn'

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'>,
    FieldVariantProps {
  errorMessage?: string
  hint?: string
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className,
      fieldSize,
      fieldState,
      errorMessage,
      hint,
      id,
      disabled,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const [visible, setVisible] = React.useState(false)
    const describedBy = [ariaDescribedBy, errorMessage ? `${id}-error` : null, hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(' ') || undefined
    const invalid = fieldState === 'error' || Boolean(errorMessage)

    return (
      <div className="flex w-full flex-col gap-1.5">
        <div className="relative flex w-full items-center">
          <input
            ref={ref}
            id={id}
            type={visible ? 'text' : 'password'}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(
              fieldVariants({ fieldSize, fieldState: invalid ? 'error' : fieldState }),
              'pe-11',
              className
            )}
            {...props}
          />
          <span className="absolute end-1">
            <IconButton
              icon={visible ? 'EyeOff' : 'Eye'}
              size="sm"
              variant="ghost"
              aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              disabled={disabled}
              onClick={() => setVisible((v) => !v)}
            />
          </span>
        </div>
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
PasswordInput.displayName = 'PasswordInput'
