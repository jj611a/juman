import * as React from 'react'
import { cn } from '@/utils/cn'

/** Public brand mark — gold calligraphy on black (store logo). */
export const JUMAN_LOGO_SRC = '/brand/juman-logo.png'

export interface AppLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string
  collapsed?: boolean
  /** `mark` = sidebar sizes; `hero` = login / auth surfaces */
  size?: 'mark' | 'hero'
}

export function AppLogo({
  name = 'جمان',
  collapsed = false,
  size = 'mark',
  className,
  ...props
}: AppLogoProps): React.ReactElement {
  const imgClass =
    size === 'hero'
      ? 'h-16 w-auto max-w-[14rem] object-contain'
      : collapsed
        ? 'h-9 w-9 object-contain object-center'
        : 'h-9 w-auto max-w-[8rem] object-contain'

  return (
    <div
      className={cn('flex items-center gap-2', collapsed && size === 'mark' && 'justify-center', className)}
      {...props}
    >
      <img
        src={JUMAN_LOGO_SRC}
        alt={name}
        className={cn(imgClass, 'select-none')}
        draggable={false}
      />
      {collapsed ? <span className="sr-only">{name}</span> : null}
    </div>
  )
}
