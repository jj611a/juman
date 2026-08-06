import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProviders } from '@/app/providers/AppProviders'
import { ErrorBoundary } from '@/app/ErrorBoundary'
import { AppRouter } from '@/router/AppRouter'
import '@/theme/globals.css'

const el = document.getElementById('root')
if (!el) throw new Error('Root element #root missing')

createRoot(el).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
)
