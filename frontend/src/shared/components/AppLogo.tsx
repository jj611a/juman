import { cn } from '@/shared/lib/cn'

export const JUMAN_LOGO_SRC = '/brand/juman-mark.svg'

export function AppLogo({
  name = 'جمان',
  size = 'mark',
  className
}: {
  name?: string
  size?: 'mark' | 'hero'
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <img
        src={JUMAN_LOGO_SRC}
        alt={name}
        className={size === 'hero' ? 'h-16 w-auto' : 'h-9 w-auto'}
        draggable={false}
      />
      <span className="font-semibold tracking-wide text-primary">{name}</span>
    </div>
  )
}
