import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { SessionView } from '@shared/session'
import { ipcAuth } from '@/ipc/auth'

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'refreshing' | 'expired'

interface SessionContextValue {
  session: SessionView | null
  status: SessionStatus
  loading: boolean
  refresh: () => Promise<void>
  login: (username: string, password: string, remember?: boolean) => Promise<void>
  logout: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

const guest: SessionView = {
  authenticated: false,
  user: null,
  mustChangePassword: false
}

// Timeout config: 15 minutes idle time, 60 seconds warning countdown.
const IDLE_TIMEOUT_MS = 15 * 60 * 1000
const WARNING_TIMEOUT_MS = 60 * 1000

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionView | null>(null)
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [showWarning, setShowWarning] = useState(false)
  const [warningCountdown, setWarningCountdown] = useState(60)

  const queryClient = useQueryClient()
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isWarnActiveRef = useRef(false)

  const loading = status === 'loading'

  const refresh = useCallback(async () => {
    setStatus((prev) => (prev === 'loading' ? 'loading' : 'refreshing'))
    try {
      const next = await ipcAuth.getSession()
      setSession(next)
      setStatus(next.authenticated ? 'authenticated' : 'unauthenticated')
    } catch {
      setSession(guest)
      setStatus('unauthenticated')
    }
  }, [])

  const logout = useCallback(async () => {
    setStatus('loading')
    try {
      const next = await ipcAuth.logout()
      setSession(next)
      setStatus('unauthenticated')
    } catch {
      setSession(guest)
      setStatus('unauthenticated')
    } finally {
      queryClient.clear()
    }
  }, [queryClient])

  // Idle timeout handlers
  const handleInactivity = useCallback(() => {
    setShowWarning(true)
    isWarnActiveRef.current = true
    setWarningCountdown(60)
  }, [])

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    
    setShowWarning(false)
    isWarnActiveRef.current = false

    if (session?.authenticated) {
      idleTimerRef.current = setTimeout(handleInactivity, IDLE_TIMEOUT_MS - WARNING_TIMEOUT_MS)
    }
  }, [session?.authenticated, handleInactivity])

  // Auto-logout when countdown hits 0
  useEffect(() => {
    if (showWarning) {
      countdownIntervalRef.current = setInterval(() => {
        setWarningCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current!)
            setStatus('expired')
            void logout()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }
  }, [showWarning, logout])

  // Setup user activity listeners
  useEffect(() => {
    if (!session?.authenticated) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      return
    }

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'click']
    const handleUserActivity = () => {
      // If warning dialogue is not open, reset the idle timer
      if (!isWarnActiveRef.current) {
        resetIdleTimer()
      }
    }

    resetIdleTimer()

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleUserActivity)
    })

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleUserActivity)
      })
    }
  }, [session?.authenticated, resetIdleTimer])

  // Listen to main process auth change notifications
  useEffect(() => {
    void (async () => {
      setStatus('loading')
      await refresh()
    })()
    
    return ipcAuth.onChanged((next) => {
      setSession(next)
      setStatus(next.authenticated ? 'authenticated' : 'unauthenticated')
    })
  }, [refresh])

  const login = useCallback(async (username: string, password: string, remember?: boolean) => {
    setStatus('loading')
    try {
      const next = await ipcAuth.login({ username, password, remember })
      setSession(next)
      setStatus(next.authenticated ? 'authenticated' : 'unauthenticated')
      await queryClient.invalidateQueries()
    } catch (err) {
      setStatus('unauthenticated')
      throw err
    }
  }, [queryClient])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await window.juman.auth.changePassword({ currentPassword, newPassword })
    await refresh()
  }, [refresh])

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      status,
      loading,
      refresh,
      login,
      logout,
      changePassword
    }),
    [session, status, loading, refresh, login, logout, changePassword]
  )

  return (
    <SessionContext.Provider value={value}>
      {children}
      
      {/* Global Inactivity Dialog */}
      {showWarning && (
        <div className="modal modal-open modal-middle select-none" dir="rtl">
          <div className="modal-box border border-base-content/10 bg-base-200/90 backdrop-blur-md shadow-2xl max-w-sm">
            <h3 className="text-lg font-bold text-warning flex items-center gap-2">
              ⚠️ تنبيه عدم النشاط
            </h3>
            <p className="py-4 text-base-content/80 text-sm leading-relaxed">
              سيتم تسجيل خروجك تلقائيًا خلال <span className="font-mono font-bold text-error text-lg">{warningCountdown}</span> ثانية بسبب عدم النشاط.
            </p>
            <div className="modal-action gap-2">
              <button 
                className="btn btn-primary btn-sm flex-1"
                onClick={resetIdleTimer}
              >
                متابعة الجلسة
              </button>
              <button 
                className="btn btn-outline btn-error btn-sm"
                onClick={() => void logout()}
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
        </div>
      )}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession requires SessionProvider')
  return ctx
}
