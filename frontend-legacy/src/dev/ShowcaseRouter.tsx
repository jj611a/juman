import { lazy, Suspense } from 'react'
import type { RouteObject } from 'react-router'
import { Navigate } from 'react-router'
import { ShowcaseApp } from './ShowcaseApp'

const AllPage = lazy(() => import('./pages/All'))
const ButtonsPage = lazy(() => import('./pages/Buttons'))
const InputsPage = lazy(() => import('./pages/Inputs'))
const SelectionPage = lazy(() => import('./pages/Selection'))
const DisplayPage = lazy(() => import('./pages/Display'))
const FeedbackPage = lazy(() => import('./pages/Feedback'))
const LayoutPage = lazy(() => import('./pages/Layout'))
const TokensPage = lazy(() => import('./pages/Tokens'))
const FormsPage = lazy(() => import('./pages/Forms'))
const DataPage = lazy(() => import('./pages/Data'))
const BusinessPage = lazy(() => import('./pages/Business'))
const ShellPage = lazy(() => import('./pages/Shell'))
const AuthPage = lazy(() => import('./pages/Auth'))

function Fallback(): React.ReactElement {
  return <div className="p-8 text-muted-foreground">جاري التحميل…</div>
}

function page(el: React.ReactNode): React.ReactElement {
  return <Suspense fallback={<Fallback />}>{el}</Suspense>
}

/** DEV-only showcase routes mounted under `/dev`. */
export function getDevRoutes(): RouteObject {
  return {
    path: '/dev',
    element: <ShowcaseApp />,
    children: [
      { index: true, element: <Navigate to="all" replace /> },
      { path: 'all', element: page(<AllPage />) },
      { path: 'buttons', element: page(<ButtonsPage />) },
      { path: 'inputs', element: page(<InputsPage />) },
      { path: 'forms', element: page(<FormsPage />) },
      { path: 'selection', element: page(<SelectionPage />) },
      { path: 'display', element: page(<DisplayPage />) },
      { path: 'feedback', element: page(<FeedbackPage />) },
      { path: 'layout', element: page(<LayoutPage />) },
      { path: 'data', element: page(<DataPage />) },
      { path: 'business', element: page(<BusinessPage />) },
      { path: 'shell', element: page(<ShellPage />) },
      { path: 'auth', element: page(<AuthPage />) },
      { path: 'tokens', element: page(<TokensPage />) },
      { path: 'design-tokens', element: <Navigate to="tokens" replace /> }
    ]
  }
}
