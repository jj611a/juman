import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const RolesListPage = lazy(() => import('./pages/RolesListPage'))
const RoleCreatePage = lazy(() => import('./pages/RoleCreatePage'))
const RoleDetailPage = lazy(() => import('./pages/RoleDetailPage'))

export const rolesRoutes: RouteObject[] = [
  {
    path: 'roles',
    element: <RolesListPage />,
    handle: {
      title: 'الأدوار',
      breadcrumb: { id: 'roles', label: 'الأدوار' }
    }
  },
  {
    path: 'roles/new',
    element: <RoleCreatePage />,
    handle: {
      title: 'دور جديد',
      breadcrumb: { id: 'roles-new', label: 'دور جديد' }
    }
  },
  {
    path: 'roles/:id',
    element: <RoleDetailPage />,
    handle: {
      title: 'تفاصيل الدور',
      breadcrumb: { id: 'roles-detail', label: 'تفاصيل الدور' }
    }
  }
]
