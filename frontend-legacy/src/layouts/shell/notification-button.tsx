import * as React from 'react'
import { IconButton } from '@/components/ui/icon-button'

export interface NotificationButtonProps
  extends Omit<React.ComponentPropsWithoutRef<typeof IconButton>, 'icon' | 'aria-label'> {
  label?: string
}

export function NotificationButton({
  label = 'الإشعارات',
  ...props
}: NotificationButtonProps): React.ReactElement {
  return <IconButton type="button" icon="Bell" aria-label={label} {...props} />
}
