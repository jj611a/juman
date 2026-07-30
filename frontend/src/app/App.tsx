import { RouterProvider } from 'react-router'
import { AppProviders } from './providers'
import { router } from './router'
import { DesktopGate } from './DesktopGate'

export function App(): React.ReactElement {
  return (
    <AppProviders>
      <DesktopGate>
        <RouterProvider router={router} />
      </DesktopGate>
    </AppProviders>
  )
}
