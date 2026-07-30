import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const CalendarHomePage = lazy(() => import('./pages/CalendarHomePage'))
const CalendarDressPage = lazy(() => import('./pages/CalendarDressPage'))

export const calendarRoutes: RouteObject[] = [
  {
    path: 'calendar',
    element: <CalendarHomePage />,
    handle: { title: 'التقويم', breadcrumb: { id: 'calendar', label: 'التقويم' } }
  },
  {
    path: 'calendar/:dressId',
    element: <CalendarDressPage />,
    handle: { title: 'تقويم الفستان', breadcrumb: { id: 'calendar-dress', label: 'تقويم الفستان' } }
  }
]
