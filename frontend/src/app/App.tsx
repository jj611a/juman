import { RouterProvider } from 'react-router'
import { AppProviders } from './providers'
import { router } from './router'

export function App(): React.ReactElement {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
