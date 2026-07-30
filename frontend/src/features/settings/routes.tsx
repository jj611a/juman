import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const SettingsPage = lazy(() => import('./pages/SettingsPage'))

export const settingsRoutes: RouteObject[] = [
  {
    path: 'settings',
    element: <SettingsPage />,
    handle: {
      title: 'الإعدادات',
      breadcrumb: { id: 'settings', label: 'الإعدادات' }
    }
  }
]
