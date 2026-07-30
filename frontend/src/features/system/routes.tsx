import { lazy } from 'react'
import { Navigate } from 'react-router'
import type { RouteObject } from 'react-router'

const SystemHomePage = lazy(() => import('./pages/SystemHomePage'))
const SystemStatusPage = lazy(() => import('./pages/SystemStatusPage'))
const SystemBackupsPage = lazy(() => import('./pages/SystemBackupsPage'))
const SystemRestorePage = lazy(() => import('./pages/SystemRestorePage'))
const SystemMaintenancePage = lazy(() => import('./pages/SystemMaintenancePage'))

export const systemRoutes: RouteObject[] = [
  {
    path: 'system',
    element: <SystemHomePage />,
    handle: { title: 'إدارة النظام', breadcrumb: { id: 'system', label: 'النظام' } },
    children: [
      { index: true, element: <Navigate to="status" replace /> },
      {
        path: 'status',
        element: <SystemStatusPage />,
        handle: { title: 'حالة النظام', breadcrumb: { id: 'system-status', label: 'الحالة' } }
      },
      {
        path: 'backups',
        element: <SystemBackupsPage />,
        handle: { title: 'النسخ الاحتياطي', breadcrumb: { id: 'system-backups', label: 'النسخ' } }
      },
      {
        path: 'restore',
        element: <SystemRestorePage />,
        handle: { title: 'الاستعادة', breadcrumb: { id: 'system-restore', label: 'الاستعادة' } }
      },
      {
        path: 'maintenance',
        element: <SystemMaintenancePage />,
        handle: {
          title: 'الصيانة',
          breadcrumb: { id: 'system-maintenance', label: 'الصيانة' }
        }
      }
    ]
  }
]
