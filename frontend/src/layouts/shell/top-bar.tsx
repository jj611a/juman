import * as React from 'react'
import { Button } from '@/components/ui/button'
import { BreadcrumbHost } from './breadcrumb-host'
import { CommandPaletteButton } from './command-palette-button'
import { GlobalSearchButton } from './global-search-button'
import { NotificationButton } from './notification-button'
import { UserMenu } from './user-menu'
import type { BreadcrumbCrumb } from '@/components/ui/breadcrumb'
import { apiClient } from '@/services/apiClient'
import { cn } from '@/utils/cn'

export interface TopBarProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title?: React.ReactNode
  breadcrumbs?: BreadcrumbCrumb[]
  onSearch?: () => void
  onCommandPalette?: () => void
  onNotifications?: () => void
  onSignOut?: () => void
  showWindowControls?: boolean
}

export function TopBar({
  title,
  breadcrumbs,
  onSearch,
  onCommandPalette,
  onNotifications,
  onSignOut,
  showWindowControls = true,
  className,
  ...props
}: TopBarProps): React.ReactElement {
  return (
    <header
      className={cn(
        'navbar min-h-14 border-b border-base-content/10 bg-neutral px-4 py-0 text-neutral-content',
        className
      )}
      {...props}
    >
      <div className="navbar-start min-w-0 flex-1 flex-col items-stretch gap-0.5 py-2">
        {title ? <p className="truncate text-body font-semibold text-base-content">{title}</p> : null}
        <BreadcrumbHost items={breadcrumbs} />
      </div>
      <div className="navbar-end gap-1">
        <GlobalSearchButton
          disabled={!onSearch}
          title={!onSearch ? 'بحث عام (قريبًا)' : undefined}
          aria-label={!onSearch ? 'بحث عام (قريبًا)' : undefined}
          onClick={onSearch}
        />
        <CommandPaletteButton
          disabled={!onCommandPalette}
          title={!onCommandPalette ? 'لوحة الأوامر (قريبًا)' : undefined}
          aria-label={!onCommandPalette ? 'لوحة الأوامر (قريبًا)' : undefined}
          onClick={onCommandPalette}
        />
        <NotificationButton
          disabled={!onNotifications}
          title={!onNotifications ? 'الإشعارات (قريبًا)' : undefined}
          aria-label={!onNotifications ? 'الإشعارات (قريبًا)' : undefined}
          onClick={onNotifications}
        />
        <UserMenu onSignOut={onSignOut} />
        {showWindowControls ? (
          <div className="ms-1 join">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="join-item"
              aria-label="تصغير"
              onClick={() => void apiClient.desktop.window.minimize()}
            >
              —
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="join-item"
              aria-label="تكبير"
              onClick={() => void apiClient.desktop.window.maximize()}
            >
              □
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="join-item"
              aria-label="إغلاق"
              onClick={() => void apiClient.desktop.window.close()}
            >
              ×
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  )
}
