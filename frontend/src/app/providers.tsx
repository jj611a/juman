import { useEffect, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import { apiClient } from '@/services/apiClient'
import { useAuthStore } from '@/stores/authStore'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { ToastProvider, toast } from '@/components/ui'
import { ShortcutProvider } from '@/app/shortcuts'
import { DialogHost, DrawerHost, GlobalLoadingHost } from '@/app/hosts'
import { ErrorBoundary } from './ErrorBoundary'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
})

function BootstrapAuth({ children }: { children: ReactNode }): ReactNode {
  const setSession = useAuthStore((s) => s.setSession)
  const setReady = useAuthStore((s) => s.setReady)

  useEffect(() => {
    let unsubscribe = (): void => undefined
    let wasAuthenticated = false
    void (async () => {
      try {
        if (window.juman) {
          const session = await apiClient.auth.getSession()
          wasAuthenticated = session.authenticated
          setSession(session)
          unsubscribe = apiClient.auth.onChanged((next) => {
            if (wasAuthenticated && !next.authenticated) {
              toast.warning(i18n.t('auth.sessionExpired'))
              window.location.hash = '#/login'
            }
            wasAuthenticated = next.authenticated
            setSession(next)
          })
        } else {
          setSession({ authenticated: false, permissions: [], mustChangePassword: false })
        }
      } catch {
        setSession({ authenticated: false, permissions: [], mustChangePassword: false })
      } finally {
        setReady(true)
      }
    })()
    return () => unsubscribe()
  }, [setReady, setSession])

  return children
}

export function AppProviders({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ToastProvider>
              <ShortcutProvider>
                <BootstrapAuth>
                  {children}
                  <GlobalLoadingHost />
                  <DialogHost />
                  <DrawerHost />
                </BootstrapAuth>
              </ShortcutProvider>
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </I18nextProvider>
    </ErrorBoundary>
  )
}
