import { useState, type FormEvent, useEffect, useRef, useCallback } from 'react'
import { Navigate } from 'react-router'
import { AppLogo } from '@/shared/components/AppLogo'
import { useSession } from '@/app/providers/SessionProvider'
import { ROUTES } from '@/shared/constants/routes'
import { PageSkeleton } from '@/shared/components/feedback/PageSkeleton'
import { Eye, EyeOff, ShieldAlert, WifiOff, Lock, AlertTriangle } from 'lucide-react'
import { PasswordChangeDialog } from './PasswordChangeDialog'

export function LoginPage() {
  const { session, loading, login } = useSession()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('Asdf1234.,')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errorType, setErrorType] = useState<'invalid' | 'locked' | 'expired' | 'network' | 'rate_limit' | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lockedUntil, setLockedUntil] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showForceChange, setShowForceChange] = useState(false)
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (session?.authenticated && session.mustChangePassword) {
      setShowForceChange(true)
    }
  }, [session])

  // Clear retry timers on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearInterval(retryTimerRef.current)
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
    }
  }, [])

  const cancelRetry = useCallback(() => {
    if (retryTimerRef.current) clearInterval(retryTimerRef.current)
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
    setRetryCountdown(null)
  }, [])

  const startRetryCountdown = useCallback((submitFn: () => Promise<void>) => {
    // clear any existing timers
    if (retryTimerRef.current) clearInterval(retryTimerRef.current)
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)

    let count = 5
    setRetryCountdown(count)

    retryTimerRef.current = setInterval(() => {
      count -= 1
      setRetryCountdown(count)
      if (count <= 0) {
        clearInterval(retryTimerRef.current!)
        retryTimerRef.current = null
      }
    }, 1000)

    retryTimeoutRef.current = setTimeout(() => {
      setRetryCountdown(null)
      void submitFn()
    }, 5000)
  }, [])

  if (loading) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center p-8 bg-base-100" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <PageSkeleton />
          <p className="text-sm text-base-content/60 font-medium">جاري استعادة الجلسة...</p>
        </div>
      </div>
    )
  }

  // If authenticated and doesn't need force password change, redirect home
  if (session?.authenticated && !session.mustChangePassword) {
    return <Navigate to={ROUTES.HOME} replace />
  }

  async function doLogin() {
    setBusy(true)
    setErrorType(null)
    setErrorMessage(null)
    setLockedUntil(null)
    cancelRetry()

    try {
      await login(username, password, remember)
    } catch (err: any) {
      const code = err?.code
      const msg = err?.message || ''
      const data = err?.data ?? err?.response?.data ?? {}

      if (code === 'NETWORK' || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('enotfound') || msg.toLowerCase().includes('connrefused')) {
        setErrorType('network')
        setErrorMessage('تعذر الاتصال بالخادم.')
        startRetryCountdown(doLogin)
      } else if (msg.toLowerCase().includes('locked') || msg.toLowerCase().includes('lockout') || code === 'HTTP_423') {
        setErrorType('locked')
        setErrorMessage('تم تعليق هذا الحساب مؤقتاً بسبب تجاوز عدد محاولات تسجيل الدخول المسموح بها.')
        // Try to extract unlock time from the backend error payload
        const until = data?.lockedUntil ?? data?.unlockAt ?? null
        if (until) {
          try {
            const d = new Date(until)
            setLockedUntil(d.toLocaleTimeString('ar-AE', { hour: '2-digit', minute: '2-digit' }))
          } catch { setLockedUntil(null) }
        }
      } else if (msg.toLowerCase().includes('expired') || code === 'HTTP_403') {
        setErrorType('expired')
        setErrorMessage('انتهت صلاحية كلمة المرور. يرجى التواصل مع مسؤول النظام.')
      } else if (code === 'HTTP_429') {
        setErrorType('rate_limit')
        setErrorMessage('تجاوزت الحد المسموح من المحاولات. يرجى الانتظار دقيقة والمحاولة مجدداً.')
      } else {
        setErrorType('invalid')
        setErrorMessage('اسم المستخدم أو كلمة المرور غير صحيحة.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!username || !password) return
    await doLogin()
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-radial from-base-300 via-base-200 to-base-100 select-none" dir="rtl">
      <div className="card w-full max-w-md border border-base-content/10 bg-base-300/80 shadow-2xl backdrop-blur-md transition-all duration-300 hover:shadow-primary/5">
        <div className="card-body gap-6 p-8">
          <div className="flex flex-col items-center gap-2">
            <AppLogo size="hero" className="justify-center" />
            <h1 className="text-xl font-bold mt-2">نظام جمان ERP</h1>
            <p className="text-center text-xs text-base-content/50">
              واجهة الإدارة والتشغيل · إصدار سطح المكتب
            </p>
          </div>

          <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
            {/* Username Input */}
            <div className="form-control w-full">
              <span className="label-text mb-1 text-xs">اسم المستخدم</span>
              <input
                className="input input-bordered juman-focus w-full bg-base-200"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={busy || showForceChange}
                autoFocus
                required
              />
            </div>

            {/* Password Input */}
            <div className="form-control w-full">
              <span className="label-text mb-1 text-xs">كلمة المرور</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input input-bordered juman-focus w-full bg-base-200 pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={busy || showForceChange}
                  required
                />
                <button
                  type="button"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={busy || showForceChange}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Session */}
            <div className="flex justify-between items-center text-xs mt-1">
              <label className="label cursor-pointer gap-2 p-0">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary checkbox-xs rounded-sm"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  disabled={busy || showForceChange}
                />
                <span className="label-text text-base-content/70">تذكر الجلسة</span>
              </label>
            </div>

            {/* Error alerts mapping */}
            {errorMessage && (
              <div className="alert alert-error text-xs p-3 flex gap-2 items-start shadow-inner">
                {errorType === 'network' && <WifiOff size={16} className="shrink-0 mt-0.5" />}
                {errorType === 'locked' && <Lock size={16} className="shrink-0 mt-0.5" />}
                {errorType === 'expired' && <AlertTriangle size={16} className="shrink-0 mt-0.5" />}
                {!['network', 'locked', 'expired'].includes(errorType || '') && <ShieldAlert size={16} className="shrink-0 mt-0.5" />}
                <div className="flex flex-col gap-1.5 flex-1">
                  <span>{errorMessage}</span>

                  {/* Locked — show unlock time or generic guidance */}
                  {errorType === 'locked' && (
                    <span className="text-[10px] opacity-80 font-mono">
                      {lockedUntil
                        ? `يمكنك المحاولة مجدداً بعد الساعة ${lockedUntil}`
                        : 'يرجى الانتظار 15 دقيقة ثم المحاولة مجدداً، أو التواصل مع مسؤول النظام.'}
                    </span>
                  )}

                  {/* Network — countdown + manual retry */}
                  {errorType === 'network' && retryCountdown !== null && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] opacity-80">
                        إعادة المحاولة خلال {retryCountdown}...
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          className="btn btn-xs btn-error btn-outline rounded-lg font-bold"
                          onClick={() => { cancelRetry(); void doLogin() }}
                        >
                          الآن
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-ghost rounded-lg opacity-70"
                          onClick={cancelRetry}
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary juman-focus w-full mt-2 font-bold"
              disabled={busy || !username || !password || showForceChange || errorType === 'locked'}
            >
              {busy ? (
                <div className="flex items-center gap-2">
                  <span className="loading loading-spinner loading-sm" />
                  <span>جاري تسجيل الدخول...</span>
                </div>
              ) : (
                'تسجيل الدخول'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Force Change Password Dialog */}
      <PasswordChangeDialog
        isOpen={showForceChange}
        onClose={() => setShowForceChange(false)}
        forceChange={true}
      />
    </div>
  )
}
