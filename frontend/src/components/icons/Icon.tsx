import * as React from 'react'
import * as LucideIcons from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import { ICON_SIZE_PX, type IconSizeToken } from '@/theme/tokens'
import { cn } from '@/utils/cn'

export type IconName = keyof typeof LucideIcons

export type IconSize = IconSizeToken | number

export interface IconProps extends Omit<LucideProps, 'ref' | 'size'> {
  name: IconName
  size?: IconSize
  /** Mirror horizontally for directional icons in RTL contexts. */
  rtlFlip?: boolean
  className?: string
  /** When set, icon is meaningful; otherwise decorative (aria-hidden). */
  title?: string
}

function resolveSize(size: IconSize): number {
  if (typeof size === 'number') return size
  return ICON_SIZE_PX[size]
}

function isLucideComponent(
  value: unknown
): value is React.ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & React.RefAttributes<SVGSVGElement>> {
  return typeof value === 'function' || (typeof value === 'object' && value !== null)
}

export const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ name, size = 'md', rtlFlip = false, className, title, ...props }, ref) => {
    const Candidate = LucideIcons[name]
    if (!isLucideComponent(Candidate)) {
      if (import.meta.env.DEV) {
        console.warn(`[Icon] Unknown Lucide icon: ${String(name)}`)
      }
      return null
    }

    const Comp = Candidate
    const px = resolveSize(size)
    const decorative = title === undefined

    return (
      <Comp
        ref={ref}
        size={px}
        aria-hidden={decorative ? true : undefined}
        role={decorative ? undefined : 'img'}
        aria-label={title}
        className={cn(rtlFlip && '-scale-x-100', 'shrink-0', className)}
        {...props}
      />
    )
  }
)
Icon.displayName = 'Icon'
