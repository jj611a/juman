import * as React from 'react'
import { IconButton } from '@/components/ui/icon-button'

export interface GlobalSearchButtonProps
  extends Omit<React.ComponentPropsWithoutRef<typeof IconButton>, 'icon' | 'aria-label'> {
  label?: string
}

export function GlobalSearchButton({
  label = 'بحث عام',
  ...props
}: GlobalSearchButtonProps): React.ReactElement {
  return <IconButton type="button" icon="Search" aria-label={label} {...props} />
}
