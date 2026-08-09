import { useCallback, useEffect, useState } from 'react'
import type { StartupStatus } from '@shared/startup'

export function useStartupStatus() {
  const [status, setStatus] = useState<StartupStatus | null>(null)

  useEffect(() => {
    let active = true
    void window.juman.startup.getStatus().then((next) => {
      if (active) setStatus(next)
    })
    const unsubscribe = window.juman.startup.onChanged((next) => {
      if (active) setStatus(next)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const retry = useCallback(() => {
    void window.juman.startup.retry()
  }, [])

  const quit = useCallback(() => {
    void window.juman.app.quit()
  }, [])

  return { status, retry, quit }
}
