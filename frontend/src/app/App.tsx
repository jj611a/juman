import { RouterProvider } from 'react-router'
import { AppProviders } from './providers'
import { router } from './router'
import { DesktopGate } from './DesktopGate'
import { DiagnosticsPage } from '@/features/diagnostics/DiagnosticsPage'

function isDiagnosticsHash(): boolean {
  if (typeof window === 'undefined') return false
  const raw = window.location.hash.replace(/^#/, '')
  return raw === '/diagnostics' || raw.startsWith('/diagnostics?')
}

export function App(): React.ReactElement {
  if (isDiagnosticsHash()) {
    return (
      <AppProviders>
        <DiagnosticsPage />
      </AppProviders>
    )
  }

  return (
    <AppProviders>
      <DesktopGate>
        <RouterProvider router={router} />
      </DesktopGate>
    </AppProviders>
  )
}
