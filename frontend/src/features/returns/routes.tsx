import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const ReturnsListPage = lazy(() => import('./pages/ReturnsListPage'))
const ReturnWizardPage = lazy(() => import('./pages/ReturnWizardPage'))
const ReturnDetailPage = lazy(() => import('./pages/ReturnDetailPage'))

export const returnsRoutes: RouteObject[] = [
  {
    path: 'returns',
    element: <ReturnsListPage />,
    handle: { title: 'المرتجعات', breadcrumb: { id: 'returns', label: 'المرتجعات' } }
  },
  {
    path: 'returns/new',
    element: <ReturnWizardPage />,
    handle: { title: 'مرتجع جديد', breadcrumb: { id: 'returns-new', label: 'مرتجع جديد' } }
  },
  {
    path: 'returns/:id',
    element: <ReturnDetailPage />,
    handle: { title: 'تفاصيل المرتجع', breadcrumb: { id: 'returns-detail', label: 'تفاصيل' } }
  }
]