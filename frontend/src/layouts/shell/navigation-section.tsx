import * as React from 'react'
import { NavigationItem } from './navigation-item'
import type { ShellNavSection } from './types'
import { cn } from '@/utils/cn'

export interface NavigationSectionProps {
  section: ShellNavSection
  collapsed?: boolean
}

export function NavigationSection({
  section,
  collapsed = false
}: NavigationSectionProps): React.ReactElement {
  const listRef = React.useRef<HTMLUListElement>(null)

  const onKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[data-nav-item]:not([aria-disabled="true"])') ?? []
    )
    if (items.length === 0) return
    const current = document.activeElement as HTMLElement | null
    const index = items.findIndex((el) => el === current || el.contains(current))
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const delta = e.key === 'ArrowDown' ? 1 : -1
      const next = items[(Math.max(index, 0) + delta + items.length) % items.length]
      next?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      items[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      items[items.length - 1]?.focus()
    }
  }

  return (
    <div className="space-y-1">
      {!collapsed ? (
        <p className="px-3 py-1 text-caption font-medium text-muted-foreground">{section.label}</p>
      ) : (
        <p className="sr-only">{section.label}</p>
      )}
      <ul
        ref={listRef}
        className={cn('space-y-0.5')}
        role="list"
        onKeyDown={onKeyDown}
      >
        {section.items.map((item) => (
          <li key={item.id}>
            <NavigationItem item={item} collapsed={collapsed} />
          </li>
        ))}
      </ul>
    </div>
  )
}
