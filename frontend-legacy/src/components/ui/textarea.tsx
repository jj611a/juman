import * as React from 'react'
import { textareaVariants } from '@/components/ui/input-base'
import type { VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/cn'

export interface TextAreaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {
  errorMessage?: string
  hint?: string
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      className,
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
    const describedBy = [ariaDescribedBy, errorMessage ? `${id}-error` : null, hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(' ') || undefined
    const invalid = fieldState === 'error' || Boolean(errorMessage)

    return (
      <div className="flex w-full flex-col gap-1.5">
        <textarea
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            textareaVariants({ fieldState: invalid ? 'error' : fieldState }),
            className
          )}
          {...props}
        />
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
TextArea.displayName = 'TextArea'
