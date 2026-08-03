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
          'juman-focus flex items-center gap-2 rounded-field px-3 py-2.5 text-body transition-[background-color,color,box-shadow] duration-[var(--duration-fast)]',
          item.disabled || !item.href
            ? 'pointer-events-none opacity-[var(--disabled-opacity)]'
            : isActive
              ? 'bg-primary/15 font-medium text-primary shadow-[inset_-2px_0_0_0_var(--color-primary)]'
              : 'text-base-content/70 hover:bg-base-content/5 hover:text-base-content',
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
