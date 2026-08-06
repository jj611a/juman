import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const SettlementsListPage = lazy(() => import('./pages/SettlementsListPage'))
const SettlementCreatePage = lazy(() => import('./pages/SettlementCreatePage'))
const SettlementDetailPage = lazy(() => import('./pages/SettlementDetailPage'))

export const settlementsRoutes: RouteObject[] = [
  {
    path: 'settlements',
    element: <SettlementsListPage />,
    handle: { title: 'تسويات التأجير', breadcrumb: { id: 'settlements', label: 'التسويات' } }
  },
  {
    path: 'settlements/new',
    element: <SettlementCreatePage />,
    handle: {
      title: 'تسوية جديدة',
      breadcrumb: { id: 'settlements-new', label: 'تسوية جديدة' }
    }
  },
  {
    path: 'settlements/:id',
    element: <SettlementDetailPage />,
    handle: {
      title: 'تفاصيل التسوية',
      breadcrumb: { id: 'settlements-detail', label: 'تفاصيل' }
    }
  }
]
