import * as React from 'react'
import { NavLink } from 'react-router'
import { Icon } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { PermissionGuard } from '@/components/ui/business/permission-guard'
import { cn } from '@/utils/cn'
import type { ShellNavItem } from './types'

export interface NavigationItemProps {
  item: ShellNavItem
  collapsed?: boolean
}

function renderBadge(badge: ShellNavItem['badge']): React.ReactNode {
  if (badge == null) return null
  if (typeof badge === 'number' || typeof badge === 'string') {
    return (
      <Badge variant="brand" className="ms-auto min-w-5 justify-center px-1.5 py-0 text-[10px]">
        {badge}
      </Badge>
    )
  }
  return (
    <Badge variant={badge.tone ?? 'brand'} className="ms-auto min-w-5 justify-center px-1.5 py-0 text-[10px]">
      {badge.label}
    </Badge>
  )
}

export function NavigationItem({ item, collapsed = false }: NavigationItemProps): React.ReactElement {
  const content = (
    <NavLink
      to={item.href ?? '#'}
      title={item.label}
      aria-label={item.label}
      aria-disabled={item.disabled || !item.href}
      data-nav-item=""
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-body transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          item.disabled || !item.href
            ? 'pointer-events-none opacity-[var(--disabled-opacity)]'
            : isActive
              ? 'bg-brand-subtle text-brand'
              : 'text-foreground-secondary hover:bg-hover hover:text-foreground',
          collapsed && 'justify-center px-2'
        )
      }
      onClick={(e) => {
        if (item.disabled || !item.href) e.preventDefault()
      }}
    >
      {item.icon ? <Icon name={item.icon} size={16} aria-hidden className="shrink-0" /> : null}
      {collapsed ? (
        !item.icon ? (
          <span aria-hidden className="text-caption font-medium">
            {item.label.slice(0, 1)}
          </span>
        ) : (
          <span className="sr-only">{item.label}</span>
        )
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {renderBadge(item.badge)}
        </>
      )}
    </NavLink>
  )

  if (item.permission || item.anyOf || item.allOf) {
    return (
      <PermissionGuard permission={item.permission} anyOf={item.anyOf} allOf={item.allOf} mode="hide">
        {content}
      </PermissionGuard>
    )
  }

  return content
}
