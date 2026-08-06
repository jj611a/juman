import * as React from 'react'
import { IconButton } from '@/components/ui/icon-button'

export interface CommandPaletteButtonProps
  extends Omit<React.ComponentPropsWithoutRef<typeof IconButton>, 'icon' | 'aria-label'> {
  label?: string
}

export function CommandPaletteButton({
  label = 'لوحة الأوامر',
  ...props
}: CommandPaletteButtonProps): React.ReactElement {
  return <IconButton type="button" icon="Command" aria-label={label} {...props} />
}
