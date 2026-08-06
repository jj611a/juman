import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const AuditListPage = lazy(() => import('./pages/AuditListPage'))
const AuditDetailPage = lazy(() => import('./pages/AuditDetailPage'))

export const auditRoutes: RouteObject[] = [
  {
    path: 'audit',
    element: <AuditListPage />,
    handle: { title: 'سجل التدقيق', breadcrumb: { id: 'audit', label: 'التدقيق' } }
  },
  {
    path: 'audit/:id',
    element: <AuditDetailPage />,
    handle: { title: 'حدث التدقيق', breadcrumb: { id: 'audit-detail', label: 'تفاصيل' } }
  }
]
