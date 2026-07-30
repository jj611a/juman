import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const SalesListPage = lazy(() => import('./pages/SalesListPage'))
const SaleCreatePage = lazy(() => import('./pages/SaleCreatePage'))
const SaleDetailPage = lazy(() => import('./pages/SaleDetailPage'))

export const salesRoutes: RouteObject[] = [
  {
    path: 'sales',
    element: <SalesListPage />,
    handle: { title: 'المبيعات', breadcrumb: { id: 'sales', label: 'المبيعات' } }
  },
  {
    path: 'sales/new',
    element: <SaleCreatePage />,
    handle: { title: 'بيع جديد', breadcrumb: { id: 'sales-new', label: 'بيع جديد' } }
  },
  {
    path: 'sales/:id',
    element: <SaleDetailPage />,
    handle: { title: 'تفاصيل البيع', breadcrumb: { id: 'sales-detail', label: 'تفاصيل' } }
  }
]
