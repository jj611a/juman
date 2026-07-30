import { lazy, Suspense } from 'react'
import { createHashRouter, Navigate, type RouteObject } from 'react-router'
import { AppShell } from '@/layouts/AppShell'
import { AuthLayout } from '@/layouts/AuthLayout'
import { getDevRoutes } from '@/dev'
import { categoriesRoutes } from '@/features/categories/routes'
import { customersRoutes } from '@/features/customers/routes'
import { inventoryRoutes } from '@/features/inventory/routes'
import { calendarRoutes } from '@/features/calendar/routes'
import { reservationsRoutes } from '@/features/reservations/routes'
import { rentalsRoutes } from '@/features/rentals/routes'
import { returnsRoutes } from '@/features/returns/routes'
import { processingRoutes } from '@/features/processing/routes'
import { salesRoutes } from '@/features/sales/routes'
import { settlementsRoutes } from '@/features/settlements/routes'
import { reportsRoutes } from '@/features/reports/routes'
import { usersRoutes } from '@/features/users/routes'
import { rolesRoutes } from '@/features/roles/routes'
import { settingsRoutes } from '@/features/settings/routes'
import { hardwareRoutes } from '@/features/hardware/routes'
import { auditRoutes } from '@/features/audit/routes'
import { systemRoutes } from '@/features/system/routes'
import { ProtectedRoute } from './ProtectedRoute'

const OpsDashboardPage = lazy(() => import('@/features/dashboard/pages/OpsDashboardPage'))
const LoginPage = lazy(() => import('@/routes/LoginPage'))
const ForcePasswordChangePage = lazy(() => import('@/routes/ForcePasswordChangePage'))
const ErrorPage = lazy(() => import('@/routes/ErrorPage'))
const NotFoundPage = lazy(() => import('@/routes/NotFoundPage'))
const ForbiddenPage = lazy(() => import('@/routes/ForbiddenPage'))

function Fallback(): React.ReactElement {
  return <div className="p-8 text-muted-foreground">جاري التحميل…</div>
}

function page(el: React.ReactNode): React.ReactElement {
  return <Suspense fallback={<Fallback />}>{el}</Suspense>
}

function withPage(routes: RouteObject[]): RouteObject[] {
  return routes.map((route) => ({
    ...route,
    element: route.element ? page(route.element) : route.element
  }))
}

const routes: RouteObject[] = [
  {
    path: '/login',
    element: <AuthLayout />,
    children: [{ index: true, element: page(<LoginPage />) }]
  },
  {
    path: '/force-password-change',
    element: <AuthLayout />,
    children: [{ index: true, element: page(<ForcePasswordChangePage />) }]
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    errorElement: page(<ErrorPage />),
    children: [
      {
        element: <AppShell />,
        children: [
          {
            index: true,
            element: page(<OpsDashboardPage />),
            handle: {
              title: 'لوحة التشغيل',
              breadcrumb: { id: 'home', label: 'الرئيسية' }
            }
          },
          ...withPage(categoriesRoutes),
          ...withPage(customersRoutes),
          ...withPage(inventoryRoutes),
          ...withPage(calendarRoutes),
          ...withPage(reservationsRoutes),
          ...withPage(rentalsRoutes),
          ...withPage(returnsRoutes),
          ...withPage(processingRoutes),
          ...withPage(salesRoutes),
          ...withPage(settlementsRoutes),
          ...withPage(reportsRoutes),
          ...withPage(usersRoutes),
          ...withPage(rolesRoutes),
          ...withPage(settingsRoutes),
          ...withPage(hardwareRoutes),
          ...withPage(auditRoutes),
          ...withPage(systemRoutes),
          {
            path: 'forbidden',
            element: page(<ForbiddenPage />),
            handle: {
              title: 'غير مصرح',
              breadcrumb: { id: 'forbidden', label: 'غير مصرح' }
            }
          },
          {
            path: 'error',
            element: page(<ErrorPage />)
          },
          {
            path: 'error/not-found',
            element: page(<NotFoundPage />)
          },
          {
            path: '*',
            element: page(<NotFoundPage />)
          }
        ]
      }
    ]
  },
  { path: '/unauthenticated', element: <Navigate to="/login" replace /> }
]

if (import.meta.env.DEV) {
  routes.push(getDevRoutes())
}

export const router = createHashRouter(routes)
