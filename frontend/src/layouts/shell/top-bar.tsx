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
        'flex items-center justify-between gap-3 border-b border-border bg-header px-4 py-2',
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        {title ? <p className="truncate text-body font-semibold text-foreground">{title}</p> : null}
        <BreadcrumbHost items={breadcrumbs} />
      </div>
      <div className="flex items-center gap-1">
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
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="تصغير"
              onClick={() => void apiClient.desktop.window.minimize()}
            >
              —
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="تكبير"
              onClick={() => void apiClient.desktop.window.maximize()}
            >
              □
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="إغلاق"
              onClick={() => void apiClient.desktop.window.close()}
            >
              ×
            </Button>
          </>
        ) : null}
      </div>
    </header>
  )
}
