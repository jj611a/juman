import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { PasswordInput } from '@/components/ui/password-input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { InlineMessage } from '@/components/ui/inline-message'
import { AppLogo } from '@/layouts/shell'
import { apiClient } from '@/services/apiClient'
import { useAuthStore } from '@/stores/authStore'

export default function LoginPage(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const ready = useAuthStore((s) => s.ready)
  const authenticated = useAuthStore((s) => s.session.authenticated)
  const mustChangePassword = useAuthStore((s) => s.session.mustChangePassword)

  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [remember, setRemember] = React.useState(true)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [online, setOnline] = React.useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  )
  const [backendVersion, setBackendVersion] = React.useState<string>('—')
  const [appVersion, setAppVersion] = React.useState<string>('—')
  const [connection, setConnection] = React.useState<'checking' | 'ok' | 'fail'>('checking')
  const usernameRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    usernameRef.current?.focus()
  }, [])

  React.useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const v = await apiClient.app.getVersion()
        if (!cancelled) setAppVersion(v || '1.0.0')
      } catch {
        if (!cancelled) setAppVersion('1.0.0')
      }
      try {
        const version = await apiClient.system.version()
        const v =
          typeof version === 'object' && version && 'version' in version
            ? String((version as { version: unknown }).version)
            : typeof version === 'string'
              ? version
              : JSON.stringify(version)
        if (!cancelled) {
          setBackendVersion(v)
          setConnection('ok')
        }
      } catch {
        if (!cancelled) {
          setConnection('fail')
          setBackendVersion('—')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (ready && authenticated) {
    return <Navigate to={mustChangePassword ? '/force-password-change' : '/'} replace />
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!username.trim() || !password) {
      setError(t('auth.validationRequired'))
      return
    }
    if (!online) {
      setError(t('auth.offline'))
      return
    }
    setPending(true)
    try {
      const session = await apiClient.auth.login({
        username: username.trim(),
        password,
        remember
      })
      setSession(session)
      if (session.mustChangePassword) {
        navigate('/force-password-change', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    } catch (err) {
      const message =
        typeof err === 'object' && err && 'message' in err
          ? String((err as { message: string }).message)
          : t('auth.loginFailed')
      setError(message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-panel p-6 shadow-md">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <AppLogo size="hero" />
        <p className="text-caption text-muted-foreground">{t('auth.loginSubtitle')}</p>
      </div>

      <form className="space-y-4" onSubmit={(e) => void submit(e)} noValidate>
        <div className="space-y-2">
          <Label htmlFor="login-username">{t('auth.username')}</Label>
          <TextInput
            id="login-username"
            ref={usernameRef}
            autoComplete="username"
            value={username}
            disabled={pending}
            onChange={(e) => setUsername(e.target.value)}
            aria-required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="login-password">{t('auth.password')}</Label>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            value={password}
            disabled={pending}
            onChange={(e) => setPassword(e.target.value)}
            aria-required
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="login-remember"
            checked={remember}
            disabled={pending}
            onCheckedChange={(v) => setRemember(v === true)}
          />
          <Label htmlFor="login-remember">{t('auth.rememberMe')}</Label>
        </div>

        {error ? <InlineMessage variant="error">{error}</InlineMessage> : null}
        {!online ? <InlineMessage variant="warning">{t('auth.offline')}</InlineMessage> : null}

        <Button type="submit" className="w-full" disabled={pending || !online}>
          {pending ? t('auth.signingIn') : t('auth.signIn')}
        </Button>
      </form>

      <div className="mt-6 space-y-1 border-t border-border pt-4 text-caption text-muted-foreground">
        <p>
          {connection === 'checking'
            ? t('connection.checking')
            : connection === 'ok'
              ? t('connection.ok')
              : t('connection.fail')}
        </p>
        <p>
          {t('connection.version')}: {backendVersion}
        </p>
        <p>
          {t('auth.appVersion')}: {appVersion}
        </p>
      </div>
    </div>
  )
}
