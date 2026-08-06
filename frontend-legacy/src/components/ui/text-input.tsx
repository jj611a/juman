import * as React from 'react'
import { Icon, type IconName } from '@/components/icons'
import { fieldVariants, type FieldVariantProps } from '@/components/ui/input-base'
import { cn } from '@/utils/cn'

export interface TextInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    FieldVariantProps {
  leadingIcon?: IconName
  trailingIcon?: IconName
  errorMessage?: string
  hint?: string
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      className,
      fieldSize,
      fieldState,
      leadingIcon,
      trailingIcon,
      errorMessage,
      hint,
      id,
      disabled,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const describedBy = [ariaDescribedBy, errorMessage ? `${id}-error` : null, hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(' ') || undefined
    const invalid = fieldState === 'error' || Boolean(errorMessage)

    return (
      <div className="flex w-full flex-col gap-1.5">
        <div className="relative flex w-full items-center">
          {leadingIcon ? (
            <span className="pointer-events-none absolute start-3 text-muted-foreground">
              <Icon name={leadingIcon} size="sm" />
            </span>
          ) : null}
          <input
            ref={ref}
            id={id}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(
              fieldVariants({ fieldSize, fieldState: invalid ? 'error' : fieldState }),
              leadingIcon && 'ps-9',
              trailingIcon && 'pe-9',
              className
            )}
            {...props}
          />
          {trailingIcon ? (
            <span className="pointer-events-none absolute end-3 text-muted-foreground">
              <Icon name={trailingIcon} size="sm" />
            </span>
          ) : null}
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
TextInput.displayName = 'TextInput'
