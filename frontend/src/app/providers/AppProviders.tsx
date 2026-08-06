import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from '@/app/providers/SessionProvider'
import { PermissionProvider } from '@/features/permissions/PermissionProvider'
import { ToastProvider } from '@/app/providers/ToastProvider'
import { DialogProvider } from '@/app/providers/DialogProvider'
import { ThemeProvider } from '@/app/providers/ThemeProvider'
import { ShortcutProvider } from '@/app/providers/ShortcutProvider'
import { ToastHost } from '@/shared/components/feedback/ToastHost'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SessionProvider>
          <PermissionProvider>
            <ToastProvider>
              <DialogProvider>
                <ShortcutProvider>
                  {children}
                  <ToastHost />
                </ShortcutProvider>
              </DialogProvider>
            </ToastProvider>
          </PermissionProvider>
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
