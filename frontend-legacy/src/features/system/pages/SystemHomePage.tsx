import * as React from 'react'
import { Navigate, NavLink, Outlet } from 'react-router'
import { Page, PageHeader } from '@/components/ui'
import { useAnyPermission, usePermission } from '@/hooks/usePermission'
import { cn } from '@/utils/cn'

const TAB_ITEMS = [
  { to: '/system/status', label: 'الحالة', permission: 'system.view' },
  { to: '/system/backups', label: 'النسخ', permission: 'system.backup' },
  { to: '/system/restore', label: 'الاستعادة', permission: 'system.restore' },
  { to: '/system/maintenance', label: 'الصيانة', permission: 'system.maintenance' }
] as const

export default function SystemHomePage(): React.ReactElement {
  const canAccess = useAnyPermission([
    'system.view',
    'system.backup',
    'system.restore',
    'system.maintenance'
  ])
  const canView = usePermission('system.view')
  const canBackup = usePermission('system.backup')
  const canRestore = usePermission('system.restore')
  const canMaintenance = usePermission('system.maintenance')

  const permissionOk: Record<string, boolean> = {
    'system.view': canView,
    'system.backup': canBackup,
    'system.restore': canRestore,
    'system.maintenance': canMaintenance
  }

  const visibleTabs = TAB_ITEMS.filter((tab) => permissionOk[tab.permission])

  if (!canAccess) return <Navigate to="/forbidden" replace />

  return (
    <Page size="full" as="main">
      <PageHeader title="إدارة النظام" description="الحالة، النسخ، الاستعادة، والصيانة" />
      <nav
        className="mb-6 inline-flex h-10 items-center gap-1 rounded-md border border-border bg-muted/40 p-1"
        aria-label="أقسام النظام"
      >
        {visibleTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                'inline-flex items-center rounded-sm px-3 py-1.5 text-caption font-medium transition-colors',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </Page>
  )
}
