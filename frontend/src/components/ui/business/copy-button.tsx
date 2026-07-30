import * as React from 'react'
import { IconButton, type IconButtonProps } from '@/components/ui/icon-button'
import { toast } from '@/components/ui/toast'

export interface CopyButtonProps extends Omit<IconButtonProps, 'icon' | 'onClick'> {
  value: string
  successMessage?: string
}

export function CopyButton({
  value,
  successMessage = 'تم النسخ',
  'aria-label': ariaLabel = 'نسخ',
  ...props
}: CopyButtonProps): React.ReactElement {
  return (
    <IconButton
      type="button"
      icon="Copy"
      aria-label={ariaLabel}
      {...props}
      onClick={() => {
        const write = navigator.clipboard?.writeText
        if (!write) {
          toast.error('تعذر النسخ')
          return
        }
        void Promise.resolve(write.call(navigator.clipboard, value)).then(
          () => {
            toast.success(successMessage)
          },
          () => {
            toast.error('تعذر النسخ')
          }
        )
      }}
    />
  )
}