import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProviders } from '@/app/providers/AppProviders'
import { ErrorBoundary } from '@/app/ErrorBoundary'
import { AppRouter } from '@/router/AppRouter'
import { StartupGate } from '@/features/startup/components/StartupGate'
import { APP_THEME_ID } from '@/shared/constants/app'
import '@/theme/globals.css'

// Set the theme before the splash renders — StartupGate shows before ThemeProvider mounts.
document.documentElement.setAttribute('data-theme', APP_THEME_ID)

const el = document.getElementById('root')
if (!el) throw new Error('Root element #root missing')

createRoot(el).render(
  <StrictMode>
    <ErrorBoundary>
      <StartupGate>
        <AppProviders>
          <AppRouter />
        </AppProviders>
      </StartupGate>
    </ErrorBoundary>
  </StrictMode>,
)
