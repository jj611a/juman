import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const FinancePage = lazy(() => import('./pages/FinancePage'))

export const financeRoutes: RouteObject[] = [
  {
    path: 'finance',
    element: <FinancePage />,
    handle: {
      title: 'المالية',
      breadcrumb: { id: 'finance', label: 'المالية' }
    }
  }
]
