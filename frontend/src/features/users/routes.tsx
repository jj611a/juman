import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const UsersListPage = lazy(() => import('./pages/UsersListPage'))
const UserCreatePage = lazy(() => import('./pages/UserCreatePage'))
const UserDetailPage = lazy(() => import('./pages/UserDetailPage'))

export const usersRoutes: RouteObject[] = [
  {
    path: 'users',
    element: <UsersListPage />,
    handle: {
      title: 'المستخدمون',
      breadcrumb: { id: 'users', label: 'المستخدمون' }
    }
  },
  {
    path: 'users/new',
    element: <UserCreatePage />,
    handle: {
      title: 'مستخدم جديد',
      breadcrumb: { id: 'users-new', label: 'مستخدم جديد' }
    }
  },
  {
    path: 'users/:id',
    element: <UserDetailPage />,
    handle: {
      title: 'تفاصيل المستخدم',
      breadcrumb: { id: 'users-detail', label: 'تفاصيل المستخدم' }
    }
  }
]
