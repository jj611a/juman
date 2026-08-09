import type { ReactNode } from 'react'
import { useStartupStatus } from '../hooks/useStartupStatus'
import { StartupSplash } from './StartupSplash'

/**
 * Gates the whole application behind backend readiness.
 * Renders children only after StartupManager reports READY (which Main emits
 * only after session.bootstrap() has run against the healthy backend), so the
 * renderer never calls Nest before the backend is up.
 */
export function StartupGate({ children }: { children: ReactNode }) {
  const { status, retry, quit } = useStartupStatus()

  if (status?.state !== 'ready') {
    return <StartupSplash status={status} onRetry={retry} onQuit={quit} />
  }

  return <>{children}</>
}
